-- ============ RETIRE THE "AI READS IT" PAGE-PHOTO UPLOAD ============
-- The Books admin panel no longer has a feature to photograph/scan book
-- pages and have a vision model OCR them (extractBookPages is gone from
-- admin.functions.ts, and so is its UI panel). Admins now get book text
-- from either a PDF's own text layer, or from uploading an MP3 narration
-- that's transcribed via speech-to-text (see transcribeBookAudio) — no
-- vision AI involved anywhere in the Books flow anymore.
--
-- The "book-pages" bucket itself is left in place (dropping it would fail,
-- or silently orphan storage rows, if any admin had already uploaded page
-- photos to it) but nothing should be able to write to it going forward.
-- The admin-read policy stays too, in case there's old content worth
-- reviewing or migrating by hand.
DROP POLICY IF EXISTS "admin write book pages bucket" ON storage.objects;
DROP POLICY IF EXISTS "admin update book pages bucket" ON storage.objects;
DROP POLICY IF EXISTS "admin delete book pages bucket" ON storage.objects;
