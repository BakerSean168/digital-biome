1. **Extract new translations into `src/i18n/ui.ts`**
   - Add keys and their translations for: `notes.title`, `notes.subtitle`, `notes.description`, `notes.searchPlaceholder`, `notes.tagPlaceholder`, `notes.loading`, `notes.loadMore`, `notes.noMatch`, `notes.clearSearch`, `notes.totalCount`, `notes.searchCount`, `footer.description`, `footer.links`, `footer.social`.

2. **Update `src/pages/notes/index.astro` and `src/pages/en/notes/index.astro` to show all notes and use i18n**
   - Change `getCollection` filter to just `() => true` to return all notes regardless of the language directory.
   - Inject the extracted translations using `useTranslations` (for server-side render) and pass the translations into the client-side `<script>` tag via `define:vars`.
   - Update client-side JavaScript to use the injected translation strings instead of hardcoded Chinese text for elements like search inputs and result counts.

3. **Update Footer Component (`src/components/common/Footer.astro`)**
   - Fetch the current language from URL using `getLangFromUrl` and retrieve translated strings with `useTranslations`.
   - Replace hardcoded Chinese texts with localized strings.

4. **Translate `src/pages/about/resume.astro` to Chinese**
   - Translate section headers like "Professional Summary", "Experience", "Education", "Skills", "Projects", "Certifications" into Chinese (e.g. "个人总结", "工作经验", "教育背景", "技能", "项目经历", "资格认证").
   - Leave `src/pages/en/about/resume.astro` unchanged as it's already in English.

5. **Create and integrate `LanguageToggle.astro` component**
   - Create `src/components/common/LanguageToggle.astro` which calculates target language path and returns a toggle link.
   - Insert it into `src/components/common/Header.astro` for both desktop and mobile views.

6. **Verify Build and Compile**
   - Run `pnpm build` in bash to verify that all components compile correctly and Astro successfully builds the output with the new additions.

7. **Pre Commit Steps**
   - Complete pre commit steps to ensure proper testing, verification, review, and reflection are done.

8. **Run All Related Tests**
   - Execute `node --experimental-strip-types --test src/**/*.test.ts` to ensure no tests are broken.
