# Tasks: Digital Biome Project Core

**Input**: Design documents from `/specs/001-project-core/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/routes.md, research.md

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Project type**: Web application (Astro static site)
- **Content**: `src/content/` (Content Collections)
- **Pages**: `src/pages/`
- **Components**: `src/components/`
- **Layouts**: `src/layouts/`
- **Utils**: `src/utils/`
- **Vault**: `vault/z/` (Git Submodule mount point)

---

## Phase 1: Setup (Shared Infrastructure) ✅ COMPLETE

**Purpose**: Project initialization and dependency configuration

- [x] T001 Create vault/z directory as Git Submodule mount point
- [x] T002 [P] Install @pagefind/default-ui dependency via pnpm
- [x] T003 [P] Update netlify.toml with Git Submodule init command in build script
- [x] T004 [P] Create .gitmodules entry for Obsidian vault repository
- [x] T005 Configure astro.config.mjs with vault/z path alias and markdown settings

---

## Phase 2: Foundational (Blocking Prerequisites) ✅ COMPLETE

**Purpose**: Core utilities and plugins that all user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 Create src/utils/notes.ts with getPublicNotes() filter function
- [x] T007 Create src/utils/notes.ts with getBookmarks() extraction function
- [x] T008 Create src/utils/notes.ts with getCategories() generation function
- [x] T009 Create src/utils/notes.ts with getGitLastModified() time function
- [x] T010 [P] Create src/utils/remark-wikilinks.ts custom remark plugin for [[link]] syntax
- [x] T011 Update src/content/config.ts with private field in wiki schema
- [x] T012 Create src/types/notes.ts with Note, Bookmark, Category type definitions
- [x] T013 Configure Pagefind integration in astro.config.mjs

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - 浏览器起始页导航 (Priority: P1) 🎯 MVP ✅ COMPLETE

**Goal**: 展示从笔记提取的书签，按标签分类显示

**Independent Test**: 访问根路径 `/`，能看到从笔记中提取的书签，按标签分类显示

### Implementation for User Story 1

- [x] T014 [P] [US1] Create src/components/dashboard/BookmarkCategory.astro component in src/components/dashboard/BookmarkCategory.astro
- [x] T015 [P] [US1] Update src/components/dashboard/BookmarkGrid.astro to use extracted bookmarks data
- [x] T016 [US1] Update src/pages/index.astro to fetch bookmarks and categories from notes utility
- [x] T017 [US1] Add empty state UI for no bookmarks in src/components/dashboard/BookmarkGrid.astro
- [x] T018 [US1] Update src/layouts/DashboardLayout.astro to support dynamic categories
- [x] T019 [US1] Add CSS styles for category sections in src/styles/global.css

**Checkpoint**: At this point, User Story 1 should be fully functional and testable independently

---

## Phase 4: User Story 2 - 笔记花园浏览 (Priority: P1) ✅ COMPLETE

**Goal**: 浏览知识库笔记，支持双链跳转和搜索筛选

**Independent Test**: 访问 `/wiki` 路由，能浏览笔记列表，点击双链能跳转到对应笔记

### Implementation for User Story 2

- [x] T020 [P] [US2] Configure wikilinks remark plugin in astro.config.mjs markdown.remarkPlugins
- [x] T021 [P] [US2] Create src/components/wiki/WikiLink.astro component with broken link styling in src/components/wiki/WikiLink.astro
- [x] T022 [US2] Create src/components/wiki/SearchBox.astro with Pagefind integration in src/components/wiki/SearchBox.astro
- [x] T023 [US2] Create src/components/wiki/TagFilter.astro component for tag filtering in src/components/wiki/TagFilter.astro
- [x] T024 [US2] Update src/pages/wiki/index.astro with search and filter UI
- [x] T025 [US2] Update src/pages/wiki/[...slug].astro to render wikilinks correctly
- [x] T026 [US2] Add CSS styles for broken wikilinks (dashed border) in src/styles/global.css
- [x] T027 [US2] Create src/components/wiki/Backlinks.astro component for reverse links in src/components/wiki/Backlinks.astro

**Checkpoint**: At this point, User Stories 1 AND 2 should both work independently

---

## Phase 5: User Story 3 - 个人主页 (Priority: P2) ✅ COMPLETE

**Goal**: 展示个人简介和最近更新的笔记

**Independent Test**: 访问 `/home` 路由，能看到个人介绍和最近笔记

### Implementation for User Story 3

- [x] T028 [P] [US3] Create src/components/home/Hero.astro component for personal intro in src/components/home/Hero.astro
- [x] T029 [P] [US3] Create src/components/home/RecentNotes.astro component in src/components/home/RecentNotes.astro
- [x] T030 [US3] Create src/pages/home.astro with Hero and RecentNotes components
- [x] T031 [US3] Update src/components/home/RecentNotes.astro to use getGitLastModified() for sorting
- [x] T032 [US3] Add navigation links to dashboard, wiki, resume in src/pages/home.astro
- [x] T033 [US3] Update src/components/common/Navigation.astro to include /home link

**Checkpoint**: At this point, User Stories 1, 2, AND 3 should all work independently

---

## Phase 6: User Story 4 - 在线简历 (Priority: P2) ✅ COMPLETE

**Goal**: 展示结构化简历，支持打印优化

**Independent Test**: 访问 `/resume` 路由，能查看简历并打印

### Implementation for User Story 4

- [x] T034 [P] [US4] Create src/components/resume/Experience.astro timeline component in src/components/resume/Experience.astro
- [x] T035 [P] [US4] Create src/components/resume/Education.astro component in src/components/resume/Education.astro
- [x] T036 [P] [US4] Create src/components/resume/Skills.astro component in src/components/resume/Skills.astro
- [x] T037 [US4] Update src/pages/resume.astro to use meta collection data
- [x] T038 [US4] Add print-optimized CSS in src/styles/global.css with @media print rules
- [x] T039 [US4] Ensure A4 paper layout in print styles with @page size and margin rules
- [x] T040 [US4] Update src/layouts/ResumeLayout.astro to remove navigation for print

**Checkpoint**: All user stories should now be independently functional

---

## Phase 7: Polish & Cross-Cutting Concerns ✅ COMPLETE

**Purpose**: Improvements that affect multiple user stories

- [x] T041 [P] Update README.md with project setup instructions
- [x] T042 [P] Update src/content/README.md with content management guide
- [x] T043 Create 404.astro page for missing notes in src/pages/404.astro
- [x] T044 [P] Add meta tags and Open Graph tags to all layouts for SEO
- [x] T045 Verify Core Web Vitals pass on all pages
- [x] T046 Test responsive design on 375px-1440px screen widths
- [x] T047 Test no-JavaScript fallback for navigation and reading

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - US1 (起始页) and US2 (笔记花园) can proceed in parallel (both P1)
  - US3 (主页) and US4 (简历) can proceed in parallel (both P2)
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 3 (P2)**: Can start after Foundational - No dependencies on other stories
- **User Story 4 (P2)**: Can start after Foundational - No dependencies on other stories

### Within Each User Story

- Components can be built in parallel (marked [P])
- Pages depend on components
- Styles after core implementation

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel
- All components within a story marked [P] can run in parallel

---

## Parallel Example: User Story 1

```bash
# Launch all components for User Story 1 together:
Task: "Create BookmarkCategory.astro component"
Task: "Update BookmarkGrid.astro to use extracted bookmarks data"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (起始页)
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Add User Story 4 → Test independently → Deploy/Demo
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (起始页)
   - Developer B: User Story 2 (笔记花园)
   - Developer C: User Story 3 (主页) + User Story 4 (简历)
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
