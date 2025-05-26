-- Japanese translations for muscle groups
-- This script adds Japanese translations based on scripts/seed_v2.sql muscle_groups data

INSERT INTO muscle_group_translations (muscle_group_id, locale, name) VALUES
-- Based on scripts/seed_v2.sql muscle_groups definition
(1, 'ja', '胸'),            -- Chest
(2, 'ja', '背中'),          -- Back  
(3, 'ja', '肩'),            -- Shoulders
(4, 'ja', '腕'),            -- Arms
(5, 'ja', '体幹'),          -- Core
(6, 'ja', '股関節・臀部'),   -- Hip & Glutes
(7, 'ja', '脚');            -- Legs

-- Corresponds to the muscle_groups data in scripts/seed_v2.sql:
-- (1,'Chest'),        -- 胸
-- (2,'Back'),         -- 背中
-- (3,'Shoulders'),    -- 肩
-- (4,'Arms'),         -- 腕
-- (5,'Core'),         -- 体幹
-- (6,'Hip & Glutes'), -- 股関節・臀部
-- (7,'Legs');         -- 脚
