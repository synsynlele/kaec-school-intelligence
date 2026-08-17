create index if not exists curriculum_nodes_parent_idx on public.curriculum_nodes(parent_id);
create index if not exists workspace_curriculum_adoptions_adopted_by_idx on public.workspace_curriculum_adoptions(adopted_by);
create index if not exists objective_curriculum_links_linked_by_idx on public.objective_curriculum_links(linked_by);
create index if not exists objective_curriculum_links_verified_by_idx on public.objective_curriculum_links(verified_by);
