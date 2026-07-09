-- Beginner lessons (Free tier). Seeded with placeholder topics/content — see
-- docs/lash-rules.md note: this is NOT real curriculum content, just generic
-- industry-standard topic titles so the feature is testable end-to-end. Replace
-- with real lesson content from the owner/a real educator before shipping for real.

CREATE TABLE lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_index int NOT NULL,
  title text NOT NULL,
  summary text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE lesson_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_id)
);
CREATE INDEX idx_lesson_completions_user_id ON lesson_completions(user_id);

INSERT INTO lessons (order_index, title, summary, content) VALUES
(1, 'Lash Extension Basics: What Are They?',
    'An introduction to what lash extensions are and how they differ from strip lashes.',
    'PLACEHOLDER CONTENT. Lash extensions are individual synthetic, silk, or mink-style fibers bonded to a client''s natural lashes one at a time (or in pre-made fans for volume sets), unlike strip lashes which sit on the lash line temporarily. Replace this with real curriculum content.'),
(2, 'Eye Anatomy & Lash Growth Cycles',
    'Understanding the anagen/catagen/telogen lash growth cycle and why it matters for retention.',
    'PLACEHOLDER CONTENT. Natural lashes grow in cycles, and extensions bonded to a lash in its shedding phase will fall out with that lash regardless of technique. Replace this with real curriculum content.'),
(3, 'Health & Safety: Patch Tests and Contraindications',
    'When to patch test, common allergens, and conditions that mean you should not proceed.',
    'PLACEHOLDER CONTENT. Always patch test new clients per your local regulations, and be aware of contraindications like active eye infections, recent lash/brow tinting, or known adhesive allergies. Replace this with real curriculum content.'),
(4, 'Tools of the Trade: Tweezers, Adhesives, and Trays',
    'An overview of the core tools every lash artist needs and how to choose them.',
    'PLACEHOLDER CONTENT. Isolation tweezers, volume tweezers, adhesive, primer, micro-brushes, and lash trays are the essentials. Replace this with real curriculum content.'),
(5, 'Isolation Technique Fundamentals',
    'Why isolation matters and common isolation mistakes beginners make.',
    'PLACEHOLDER CONTENT. Isolation means separating one natural lash (or a small controlled section) before applying an extension, to avoid stickies. Replace this with real curriculum content.'),
(6, 'Classic Lash Application Step-by-Step',
    'A walkthrough of the classic (1:1) application process from prep to finish.',
    'PLACEHOLDER CONTENT. Classic sets apply one extension per isolated natural lash. Replace this with real curriculum content.'),
(7, 'Introduction to Volume Fanning',
    'The basics of hand-making volume fans versus using pre-made fans.',
    'PLACEHOLDER CONTENT. Volume sets use multiple thin extensions per natural lash, fanned out to distribute weight safely. Replace this with real curriculum content.'),
(8, 'Adhesive Curing & the Role of Humidity',
    'How humidity and temperature affect adhesive cure time — see the in-app glue tool.',
    'PLACEHOLDER CONTENT. See the Glue & Humidity tool in the app for a quick reference; this lesson should explain the underlying chemistry in more depth. Replace this with real curriculum content.'),
(9, 'Aftercare: What to Tell Every Client',
    'The aftercare instructions that protect both retention and lash health.',
    'PLACEHOLDER CONTENT. Cover oil-free products, avoiding water/steam for the first hours, gentle cleansing, and not picking at extensions. Replace this with real curriculum content.'),
(10, 'Building Your First Client Consultation',
    'How to structure a consultation: assessing natural lashes, discussing style, setting expectations.',
    'PLACEHOLDER CONTENT. A good consultation covers natural lash health, desired look, lifestyle factors, and realistic expectations before any application begins. Replace this with real curriculum content.');
