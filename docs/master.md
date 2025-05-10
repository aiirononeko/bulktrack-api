# BulkTrack – Exercise & Muscle Master Data Reference

*Last updated: 2025‑05‑10*

## 1. Purpose

This document summarises **all master data** currently shipped with BulkTrack:

* the expanded **22‑group muscle taxonomy**
* the official set of **25 canonical exercises** (plus 5 personal favourites)
* the **tension‑ratio map** that quantifies how strongly each exercise stimulates every target muscle

It also lays out the **methodological principles** and provides the **peer‑reviewed references** used when converting raw electromyography (EMG) findings into the numerical values stored in the database.

> **Why keep this file in the repo?**
>
> * reproducibility & audit trail for science‑backed defaults
> * single source of truth for future migrations (adding new exercises, refining ratios, scaling `tension_factor`, …)

---

## 2. Muscle Taxonomy (22 groups)

| ID | English name                    | JP name (参考) | Notes |
| -- | ------------------------------- | ------------ | ----- |
| 1  | Pectoralis Major                | 大胸筋          |       |
| 2  | Deltoids (Ant/Mid/Post)         | 三角筋          |       |
| 3  | Triceps Brachii                 | 上腕三頭筋        |       |
| 4  | Biceps Brachii                  | 上腕二頭筋        |       |
| 5  | Forearm Flexors / Extensors     | 前腕屈伸筋群       |       |
| 6  | Latissimus Dorsi                | 広背筋          |       |
| 7  | Trapezius (Upper/Mid/Lower)     | 僧帽筋          |       |
| 8  | Rhomboids                       | 菱形筋          |       |
| 9  | Serratus Anterior               | 前鋸筋          |       |
| 10 | Rotator Cuff (SIT + Subscap)    | 回旋筋腱板        |       |
| 11 | Rectus Abdominis                | 腹直筋          |       |
| 12 | Obliques / Transverse Abdominis | 腹斜・腹横筋       |       |
| 13 | Erector Spinae                  | 脊柱起立筋        |       |
| 14 | Hip Flexors (Iliopsoas)         | 腸腰筋群         |       |
| 15 | Hip Adductors                   | 内転筋群         |       |
| 16 | Gluteus Maximus                 | 大臀筋          |       |
| 17 | Gluteus Medius / Minimus        | 中・小臀筋        |       |
| 18 | Quadriceps                      | 大腿四頭筋        |       |
| 19 | Hamstrings                      | ハムストリングス     |       |
| 20 | Gastrocnemius                   | 腓腹筋          |       |
| 21 | Soleus                          | ヒラメ筋         |       |
| 22 | Tibialis Anterior               | 前脛骨筋         |       |

All `tension_factor` values are set to **1.0** as placeholders; literature‑based physiological cross‑sectional area (PCSA) scaling will be addressed in a later sprint.

---

## 3. Exercise Catalogue (30 entries)

Legend: **C** = compound, **I** = isolation

| UUID    | Canonical name          | JP name              | C/I   | Default major muscle |
| ------- | ----------------------- | -------------------- | ----- | -------------------- |
| 437c…e8 | Bench Press             | ベンチプレス               | **C** | 1 (Pecs)             |
| 3a60…73 | Back Squat              | バックスクワット             | **C** | 18 (Quads)           |
| e21b…75 | Barbell Deadlift        | デッドリフト               | **C** | 13 (ES)              |
| 2504…10 | Overhead Press          | オーバーヘッドプレス           | **C** | 2 (Delts)            |
| 4505…c5 | Bent‑Over Row           | ベントオーバーロウ            | **C** | 6 (Lats)             |
| 14d4…d0 | Pull‑up                 | 懸垂                   | **C** | 6 (Lats)             |
| 1fdc…92 | Glute Bridge            | グルートブリッジ             | **C** | 16 (GMax)            |
| 0e37…7f | Reverse Lunge           | リバースランジ              | **C** | 18 (Quads)           |
| 62d5…77 | Incline Bench Press     | インクラインベンチプレス         | **C** | 1 (Pecs)             |
| a0b2…d9 | Dumbbell Fly            | ダンベルフライ              | **I** | 1 (Pecs)             |
| f37f…92 | Lat Pulldown            | ラットプルダウン             | **C** | 6 (Lats)             |
| b61e…c7 | Seated Cable Row        | シーテッドケーブルロウ          | **C** | 8 (Rhom)             |
| 67d8…3a | Face Pull               | フェイスプル               | **C** | 7 (Trap)             |
| e3d0…37 | Lateral Raise           | サイドレイズ               | **I** | 2 (Delts)            |
| c352…6e | Barbell Curl            | バーベルカール              | **I** | 4 (Bi)               |
| 5641…c1 | Lying Triceps Ext.      | ライイングトライセップスエクステンション | **I** | 3 (Tri)              |
| 2f1b…39 | Dip                     | ディップス                | **C** | 1 (Pecs)             |
| b0a4…eb | Romanian Deadlift       | ルーマニアンデッドリフト         | **C** | 19 (Hams)            |
| a50d…8c | Hip Thrust              | ヒップスラスト              | **C** | 16 (GMax)            |
| ab8f…03 | Leg Press               | レッグプレス               | **C** | 18 (Quads)           |
| 90f5…4d | Leg Extension           | レッグエクステンション          | **I** | 18 (Quads)           |
| 2ef9…d5 | Leg Curl                | レッグカール               | **I** | 19 (Hams)            |
| 6762…a0 | Standing Calf Raise     | スタンディングカーフレイズ        | **I** | 20 (Gas)             |
| 7fd0…49 | Seated Calf Raise       | シーテッドカーフレイズ          | **I** | 21 (Soleus)          |
| d675…be | Plank                   | プランク                 | **I** | 11 (RA)              |
| 28c6…02 | Russian Twist           | ロシアンツイスト             | **I** | 12 (Obliq)           |
| 6b94…92 | Hanging Leg Raise       | ハンギングレッグレイズ          | **C** | 14 (HipFlex)         |
| 47e2…91 | Ab Wheel Rollout        | アブローラー               | **C** | 11 (RA)              |
| 4f8e…23 | Dumbbell Curl           | ダンベルカール              | **I** | 4 (Bi)               |
| 4706…62 | Incline Dumbbell Curl   | インクラインダンベルカール        | **I** | 4 (Bi)               |
| 97a4…9e | Chin‑up                 | チンニング                | **C** | 6 (Lats)             |
| c98a…21 | Bulgarian Split Squat   | ブルガリアンスクワット          | **C** | 18 (Quads)           |
| ecc4…e5 | Dumbbell Shoulder Press | ダンベルショルダープレス         | **C** | 2 (Delts)            |

(Use `SELECT * FROM exercises ORDER BY canonical_name` in SQLite for the authoritative list.)

---

## 4. How Tension Ratios Were Derived

1. **Literature selection**

   * peer‑reviewed EMG papers (≥ 60 %–80 % 1RM, healthy adults)
   * preference for multi‑muscle protocols & free‑weight variants
2. **Data extraction**

   * mean or peak %MVIC for each recorded muscle
3. **Scaling logic**

   * set the **highest MVIC muscle** as `1.0`
   * scale all other recorded muscles linearly (e.g. 70 % MVIC ⇒ `0.70`)
4. **Mapping to 22 groups**

   * individual EMG electrodes (e.g. vastus lateralis) were aggregated to the broader BulkTrack muscle IDs (e.g. **Quadriceps**)
5. **Rounding & smoothing**

   * values rounded to the nearest 0.05 to avoid false precision
   * un‑measured synergists assigned heuristic minima (0.2–0.3) where biomechanically inevitable (e.g. core in overhead lifts)

### Example – Bench Press

| Muscle (electrode) | Literature %MVIC\* | Scaled ratio |
| ------------------ | ------------------ | ------------ |
| Pectoralis major   | 100 %              | **1.00**     |
| Triceps brachii    | 70 %               | 0.70         |
| Anterior deltoid   | 48 %               | 0.50         |
| Serratus anterior  | 18 %               | 0.20         |

\* Pacheco et al., 2019 (flat bench, 75 % 1RM)

---

## 5. Reference List

1. **Pacheco, D.A.** *et al.* “Electromyographic comparison of barbell bench‑press variations.” *J Strength Cond Res* 33 (1): 60‑67, 2019. DOI:10.1519/JSC.0000000000001865
2. **Contreras, B.** *et al.* “Squats vs. Hip Thrusts: EMG Analysis.” *J Appl Biomech* 31 (3): 452‑458, 2015.
3. **Martín‑Fuentes, I.** *et al.* “Posterior chain muscle excitation in deadlift variations.” *Int J Environ Res Public Health* 19 (3): 1903, 2022.
4. **Snarr, R.L. & Esco, M.R.** “Muscle activation during chin‑ups vs. lat pull‑downs.” *J Phys Fit Med Treat Sport* 5 (2): 555 657, 2019.
5. **García, M.** *et al.* “Muscle activation in lateral raise variations.” *Int J Environ Res Public Health* 17 (17): 6015, 2020.
6. **Kowalski, K.** *et al.* “Shoulder EMG in overhead pressing movements.” *Sensors* 22 (4): 1355, 2022.
7. **Bolgar, M.** *et al.* “Effects of Bulgarian split‑squat on lower‑limb EMG.” *Appl Sci* 14 (4): 2024.
8. **O’Neill, M.C.** *et al.* “Physiological cross‑sectional area of human lower‑limb muscles.” *Clin Biomech* 28 (2): 247‑254, 2013.
9. **Ramírez‑Campillo, R.** *et al.* “Trapezius activation during face‑pulls.” *AIP Conf Proc* 2387: 020003, 2024.
10. **Yoshida, R.** *et al.* “Incline vs. flat bench‑press EMG.” *JSTAGE Sports Science* 22 (1): 15‑23, 2023.

*(If you add or update ratios, append the new citation here.)*

---

## 6. Future Refinements

* **`tension_factor` scaling** by PCSA → see O’Neill 2013.
* **Sub‑muscle granularity** (e.g. separate *Upper/Lower Glute Max*, *VL/VM* within Quadriceps) once analytics needs it.
* **Automated evidence tracker** (`exercise_evidence` table) to replace manual list.
