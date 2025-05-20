# API Implementation Roadmap (Post-OpenAPI Exercise Endpoint Refactor)

This document outlines the tasks required to implement the changes made to the `exercises` related endpoints in `api/openapi.yaml`. Each task is designed to be a single Pull Request.

## Task 1: Standardize Localization for Exercise Endpoints

*   **PR Title Suggestion:** `feat(api): Standardize localization for exercise endpoints`
*   **Description:**
    Modify exercise-related API endpoints (`GET /v1/exercises`, `GET /v1/me/exercises/recent`) to exclusively use the `Accept-Language` header for language negotiation. This involves:
    *   Removing the `locale` query parameter from these endpoints.
    *   Ensuring the backend logic correctly processes the `Accept-Language` header to return exercise names in the preferred language.
*   **Affected `openapi.yaml` sections:**
    *   `paths./v1/exercises.get.parameters` (removal of `locale` query param, update to `Accept-Language` description)
    *   `paths./v1/me/exercises/recent.get.parameters` (removal of `locale` query param)
*   **Implementation Details:**
    *   Update request parsing in handlers for `GET /v1/exercises` and `GET /v1/me/exercises/recent`.
    *   Modify service layers (e.g., `src/app/query/exercise/`) to retrieve and use the language from the `Accept-Language` header.
    *   Verify that exercise name retrieval logic correctly prioritizes this header.

## Task 2: Enhance `GET /v1/exercises` Endpoint Functionality & Add Pagination

*   **PR Title Suggestion:** `feat(api): Enhance GET /v1/exercises with pagination and refined search`
*   **Description:**
    Update the `GET /v1/exercises` endpoint to align with the new OpenAPI definition. This includes:
    *   Changing its API summary to "Search available exercises or list all available exercises."
    *   Implementing pagination using `limit` and `offset` query parameters. This applies when listing all available exercises (i.e., when no search query `q` is provided).
    *   Ensuring the endpoint performs a prefix search on exercise names when the `q` parameter is present.
*   **Affected `openapi.yaml` sections:**
    *   `paths./v1/exercises.get.summary`
    *   `paths./v1/exercises.get.parameters` (addition of `limit` and `offset` query params)
*   **Implementation Details:**
    *   Modify the request handler for `GET /v1/exercises` (e.g., `src/interface/http/handlers/exercise/search.ts`).
    *   Update the corresponding service logic (e.g., `src/app/query/exercise/search-exercise.ts`) to:
        *   Accept `limit` and `offset` parameters.
        *   Apply pagination to the database query when `q` is not provided.
        *   Maintain prefix search functionality when `q` is provided.

## Task 3: Add `isOfficial` Property to Exercise Schema and Logic

*   **PR Title Suggestion:** `feat(exercise): Add isOfficial property to Exercise entity and API`
*   **Description:**
    Introduce an `isOfficial` boolean property to the `Exercise` data model and API schema. This field will differentiate between system-defined ("official") exercises and user-created ("custom") exercises.
    *   `isOfficial` should be `true` for exercises seeded by the system (official exercises).
    *   `isOfficial` should be `false` for exercises created by users via `POST /v1/exercises` (custom exercises).
*   **Affected `openapi.yaml` sections:**
    *   `components.schemas.Exercise.properties` (addition of `isOfficial` boolean property)
*   **Implementation Details:**
    *   **Database:** Add an `is_official` column (boolean, non-null, default e.g., `false` or handle in application logic) to the `exercises` table in `src/infrastructure/db/schema.ts`. Generate and apply migration.
    *   **Entity/DTOs:**
        *   Update the `Exercise` entity/interface in domain layer (`src/domain/exercise/entity.ts`).
        *   Update the `Exercise` DTO (`src/app/dto/exercise.ts`) to include `isOfficial`.
    *   **Exercise Creation:** Modify the `POST /v1/exercises` handler/service (`src/interface/http/handlers/exercise/create.ts`, `src/app/command/exercise/...`) to ensure `isOfficial` is set to `false` when a new custom exercise is created.
    *   **Exercise Retrieval:** Ensure all services and handlers that return `Exercise` objects (e.g., for `GET /v1/exercises`, `GET /v1/me/exercises/recent`) correctly populate the `isOfficial` field.
    *   **Seed Data:** Update any database seed scripts (e.g., `scripts/seed_v2.sql`) to set `isOfficial = true` for all system-provided exercises.

---
# API Implementation Roadmap (Sets Endpoint Refactor)

## Task 4: Implement Schema Changes for Set Endpoints

*   **PR Title Suggestion:** `refactor(sets): Align Set schemas with OpenAPI and remove sessionId`
*   **Description:**
    Reflect the recent OpenAPI schema changes for Set-related DTOs and entities in the backend codebase. This primarily involves:
    *   Removing the `sessionId` field from `WorkoutSet` representations (DTOs, entities, database if applicable).
    *   Removing any references or logic related to the now-deleted `distance` and `duration` fields in `SetCreate`, `WorkoutSet`, and `SetUpdate`.
*   **Affected `openapi.yaml` sections (for reference):**
    *   `components.schemas.WorkoutSet.properties` (removal of `sessionId`)
    *   `components.schemas.SetCreate.properties` (removal of `distance`, `duration` comments)
    *   `components.schemas.SetUpdate.properties` (removal of `distance`, `duration` comments)
*   **Implementation Details:**
    *   **Database:** If `session_id` exists on the `workout_sets` table (in `src/infrastructure/db/schema.ts`) and is no longer conceptually needed, remove it. Generate and apply migration.
    *   **Entity/DTOs:**
        *   Update the `WorkoutSet` entity/interface in the domain layer (`src/domain/workout/entities/workout-set.entity.ts`) to remove `sessionId`.
        *   Update the `WorkoutSet` DTO (`src/app/dto/set.dto.ts`) to remove `sessionId`.
        *   Ensure `SetCreate` and `SetUpdate` DTOs do not contain `distance` or `duration`.
    *   **Service/Repository Layers:** Remove any logic that processes or relies on `sessionId` for individual sets if it's no longer relevant. Remove any handling for `distance` or `duration`.

## Task 5: Implement Localization for `exerciseName` in Set Responses

*   **PR Title Suggestion:** `feat(sets): Add Accept-Language support for exerciseName in Set responses`
*   **Description:**
    Modify `GET /v1/sets` and `PATCH /v1/sets/{setId}` endpoints to support the `Accept-Language` header. The `exerciseName` field within the `WorkoutSet` objects in their responses should be translated according to the preferred language(s) specified in this header.
*   **Affected `openapi.yaml` sections (for reference):**
    *   `paths./v1/sets.get.parameters` (addition of `Accept-Language` header)
    *   `paths./v1/sets/{setId}.patch.parameters` (addition of `Accept-Language` header)
*   **Implementation Details:**
    *   Update request parsing in handlers for `GET /v1/sets` and `PATCH /v1/sets/{setId}` to read the `Accept-Language` header.
    *   Pass the language preference to the service layer responsible for fetching set data.
    *   Ensure the logic that populates `exerciseName` in `WorkoutSet` (likely involving a join or lookup to the exercises table/service) uses the provided language preference for translation.

## Task 6: Implement Sorting for `GET /v1/sets`

*   **PR Title Suggestion:** `feat(sets): Implement sortBy parameter for GET /v1/sets`
*   **Description:**
    Implement sorting functionality for the `GET /v1/sets` endpoint based on the `sortBy` query parameter. The API defines `performedAt_asc` and `performedAt_desc` as possible values, with `performedAt_desc` (most recent first) as the default.
*   **Affected `openapi.yaml` sections (for reference):**
    *   `paths./v1/sets.get.parameters` (addition of `sortBy` query param)
*   **Implementation Details:**
    *   Modify the request handler for `GET /v1/sets` to parse the `sortBy` parameter.
    *   Update the corresponding service and repository logic (e.g., `src/infrastructure/db/repository/workout-set-repository.ts`) to:
        *   Accept the sort criteria.
        *   Apply the correct `ORDER BY` clause (e.g., `performed_at ASC` or `performed_at DESC`) to the database query.
        *   Handle the default sort order if `sortBy` is not provided.

---
# API Implementation Roadmap (Dashboard Endpoint Refactor)

## Task 7: Implement Localization for Dashboard Endpoint

*   **PR Title Suggestion:** `feat(dashboard): Add Accept-Language support for Dashboard responses`
*   **Description:**
    Modify the `GET /v1/dashboard` endpoint to support the `Accept-Language` header. Translatable strings within the `DashboardResponse` (e.g., `MuscleGroupSeries.groupName`, and potentially display names for `MetricSeries.metricKey` or `unit` if these are determined to be translatable) should be returned in the preferred language(s).
*   **Affected `openapi.yaml` sections (for reference):**
    *   `paths./v1/dashboard.get.parameters` (addition of `Accept-Language` header)
*   **Implementation Details:**
    *   Update the request handler for `GET /v1/dashboard` (e.g., `src/interface/http/handlers/dashboard/stats.ts`) to read the `Accept-Language` header.
    *   Pass the language preference to the service layer (e.g., `src/app/query/dashboard/get-dashboard-data.ts`).
    *   Ensure that data retrieval logic for `MuscleGroupSeries.groupName` (and any other identified translatable fields like those in `MetricSeries`) uses the language preference. This might involve changes in how these names are stored or fetched if they require translation.

## Task 8: Refactor `DashboardResponse` DTO and Date Handling

*   **PR Title Suggestion:** `refactor(dashboard): Update DashboardResponse DTO and date formats`
*   **Description:**
    Align backend DTOs with the updated OpenAPI specification for the dashboard endpoint. This includes:
    *   Removing `userId` and `span` fields from the `DashboardResponse` DTO.
    *   Ensuring `weekStart` fields in all relevant DTOs (`WeekPoint`, `MuscleGroupWeekPoint`, `MetricSeries` points) are consistently handled (e.g., as ISO date strings or `Date` objects, aligning with the `format: date` in OpenAPI).
*   **Affected `openapi.yaml` sections (for reference):**
    *   `components.schemas.DashboardResponse` (removal of `userId`, `span`; `required` list updated)
    *   `components.schemas.WeekPoint.properties.weekStart` (`format: date` added)
    *   `components.schemas.MuscleGroupWeekPoint.properties.weekStart` (`format: date` added)
    *   `components.schemas.MetricSeries.properties.points.items.properties.weekStart` (`format: date` added)
*   **Implementation Details:**
    *   Modify the `DashboardResponse` DTO (e.g., `src/app/query/dashboard/dto.ts`) to remove `userId` and `span` properties.
    *   Review and update DTOs for `WeekPoint`, `MuscleGroupWeekPoint`, and the points within `MetricSeries` to ensure `weekStart` is consistently typed and formatted (e.g., as an ISO 8601 date string `YYYY-MM-DD` if it's being serialized directly from such a type).
    *   Verify that service layer logic (`src/app/query/dashboard/get-dashboard-data.ts`) correctly constructs these DTOs without the removed fields and with proper date representations.
