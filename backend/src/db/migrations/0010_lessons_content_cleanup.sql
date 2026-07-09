-- Lesson content previously embedded internal placeholder instructions
-- ("Replace this with real curriculum content") directly in the user-facing text,
-- so testers would see it verbatim. Trims that instruction out of the content itself
-- — the mobile app now shows a "Draft" badge instead (see LessonListScreen /
-- LessonDetailScreen), which is the correct place for that signal, not the copy.

UPDATE lessons
SET content = trim(both ' ' from replace(
  replace(content, 'PLACEHOLDER CONTENT. ', ''),
  ' Replace this with real curriculum content.', ''
));
