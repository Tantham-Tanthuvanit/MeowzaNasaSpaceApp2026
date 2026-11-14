-- Seed famous sky targets as initial projects
insert into public.projects (name, description, color, ra_deg, dec_deg, bands)
values
  ('Barnard''s Star', 'High proper motion red dwarf, the second-closest known star system to the Sun.', '#FF8A3D', 269.452077, 4.693365, '{1,2,3,4,5,6}'),
  ('Epsilon Indi B', 'A pair of cold brown dwarfs (Ba and Bb) orbiting the nearby star Epsilon Indi.', '#C9A7FF', 331.044147, -56.782844, '{1,2,3,4,5,6}'),
  ('WISE 0855', 'A fast-moving, sub-zero brown dwarf only 7.2 light-years from Earth (RA 08h55m10.831s, Dec -7°14′42.53″).', '#5AB4FF', 133.795129, -7.245147, '{1,2,3,4,5,6}'),
  ('RW Aurigae', 'A variable young binary star system undergoing dramatic dimming events caused by circumstellar dust.', '#7EE0B5', 76.956526, 30.401438, '{1,2,3,4,5,6}'),
  ('R Draconis', 'A Mira-type pulsating red giant variable star with extreme brightness variations over a ~245-day cycle.', '#EE7F22', 248.167611, 66.754979, '{1,2,3,4,5,6}')
on conflict do nothing;
