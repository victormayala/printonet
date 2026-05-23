
DO $mig$
DECLARE
  rec RECORD;
  new_variants JSONB;
  v JSONB;
  hex_val TEXT;
  changed BOOLEAN;
BEGIN
  CREATE TEMP TABLE _color_hex_lookup2 (name TEXT PRIMARY KEY, hex TEXT NOT NULL) ON COMMIT DROP;
  INSERT INTO _color_hex_lookup2 (name, hex) VALUES
  ('ath heather', '#9aa0a3'),
  ('athl heather', '#9aa0a3'),
  ('athletic hthr', '#9aa0a3'),
  ('athletic mar', '#5c1a1b'),
  ('athlhthr', '#9aa0a3'),
  ('awrnspnkht', '#ec4899'),
  ('banana', '#fce570'),
  ('battleship gry', '#5a6772'),
  ('blkhthr', '#3a3a3a'),
  ('carolinabl', '#56a0d3'),
  ('chryblsm', '#ffb7c5'),
  ('coffee bean', '#4b2e1f'),
  ('coyotebrn', '#8a6b4c'),
  ('creme', '#f5f0e1'),
  ('crnationpk', '#ffa6c9'),
  ('daffodil yelow', '#ffd200'),
  ('dark choc brn', '#3b2418'),
  ('deep marine', '#0e3a66'),
  ('deep smoke', '#5a5d63'),
  ('dkhtgry', '#5a5d63'),
  ('dp smoke', '#5a5d63'),
  ('euclptusbl', '#8bb0b3'),
  ('flntbluhtr', '#6b8092'),
  ('gardenia', '#f5f0e1'),
  ('gphheather', '#5a5d63'),
  ('gryconhthr', '#808080'),
  ('gyconcrete', '#808080'),
  ('hibiscus', '#b43757'),
  ('ht russet', '#80461b'),
  ('hthr ath marn', '#5c1a1b'),
  ('hthr dk chc bn', '#3b2418'),
  ('hthr sangria', '#7a1830'),
  ('hthrrusset', '#80461b'),
  ('htkllygrn', '#1c7847'),
  ('icelndicpr', '#a4b6cf'),
  ('laurelgrn', '#7a8c5a'),
  ('lightyllw', '#ffd200'),
  ('lthtgry', '#c0c0c0'),
  ('marigldhtr', '#f0a830'),
  ('neptunebl', '#1f6fb5'),
  ('oaththr', '#d2c4a8'),
  ('oatmeal hthr', '#d2c4a8'),
  ('olvdrabgn', '#6b6e3a'),
  ('olvdrabgnh', '#6b6e3a'),
  ('oxford', '#3d4a5a'),
  ('pistachio', '#93c572'),
  ('sangria', '#7a1830'),
  ('sapphire', '#0f52ba'),
  ('seamist', '#a8d5c0'),
  ('smk gry/chrome', '#5a5d63'),
  ('stnwshdbl', '#6b8092'),
  ('sunflower yllw', '#ffc40c'),
  ('tennessee orng', '#ff8200'),
  ('tidal wave', '#1f6fb5'),
  ('trceladon', '#8ab39b'),
  ('trnvyhthr', '#0a1f44'),
  ('troyhthr', '#1f3da5'),
  ('true celadon', '#8ab39b'),
  ('true nvy/tr ny', '#0a1f44'),
  ('truekllygr', '#1c7847'),
  ('tundrablu', '#1f6fb5'),
  ('ultramarine', '#3f00ff'),
  ('vintage hthr', '#9aa0a3'),
  ('woodlandbr', '#6b4226');

  FOR rec IN SELECT id, variants FROM public.inventory_products WHERE jsonb_typeof(variants) = 'array' LOOP
    new_variants := '[]'::jsonb;
    changed := false;
    FOR v IN SELECT * FROM jsonb_array_elements(rec.variants) LOOP
      hex_val := NULL;
      IF v->>'hex' IS NULL OR v->>'hex' = '' OR NOT (v->>'hex' ~* '^#?[0-9a-f]{6}$') THEN
        SELECT hex INTO hex_val FROM _color_hex_lookup2 WHERE name = lower(v->>'color');
        IF hex_val IS NOT NULL THEN
          v := v || jsonb_build_object('hex', hex_val);
          changed := true;
        END IF;
      END IF;
      new_variants := new_variants || v;
    END LOOP;
    IF changed THEN
      UPDATE public.inventory_products SET variants = new_variants WHERE id = rec.id;
    END IF;
  END LOOP;
END
$mig$;
