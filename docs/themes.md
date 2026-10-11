# Fixed UI appearance

The application uses one fixed visual palette: **Supabase**. There is no in-app palette chooser, appearance page, light/dark toggle, or command-palette theme action. Light and dark colors are selected automatically from the operating-system preference.

## Source of truth

- `src/components/themes/theme.config.ts` sets `DEFAULT_THEME` to `supabase`.
- `src/app/layout.tsx` applies that theme to the document root and configures system color mode.
- `src/styles/theme.css` imports only `src/styles/themes/supabase.css`.
- `src/app/layout.tsx` loads Outfit; `src/styles/theme.css` uses it as the sans-serif font.

To adjust the product's colors, edit the Supabase CSS tokens in `src/styles/themes/supabase.css`. Keep the `[data-theme='supabase']` and `[data-theme='supabase'].dark` selectors in sync so automatic system color mode continues to work. Do not add a user-facing theme selector unless the product requirement changes.

Other CSS files in `src/styles/themes/` are retained as starter/reference assets but are not imported into the application and are not selectable.
