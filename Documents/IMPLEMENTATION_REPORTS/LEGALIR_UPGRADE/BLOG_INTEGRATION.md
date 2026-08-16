# Blog Integration

**Section:** §11–§14, §36
**Status:** Implemented

## Summary

Real Persian legal blog content (no Lorem Ipsum) is now surfaced in three
places:

1. **Landing header nav** — «وبلاگ حقوقی» link.
2. **Landing Blog section** — preview cards with category, title, excerpt,
   and reading time.
3. **Dashboard** — a Blog card row under the main activity feed.

## Route mapping

| Route | Content |
| --- | --- |
| `/blog` | Blog index with category filter + search + featured post |
| `/blog/[slug]` | Single post with bookmark toggle |

## Content source

Posts are served from the `useBlogPosts` hook (backed by real Persian
content — no Lorem Ipsum per §36). Each post carries `id`, `slug`, `titleFa`,
`excerpt`, `category`, `readingTime`, `featured`.

## Design

- Blog cards use the Material `bg-surface` + `border-divider/60` + subtle
  elevation tokens.
- Category badges use the `secondary` accent palette for consistent branding.
- Featured post is highlighted on the index page.
- Reading time is shown in Persian with tabular numerals.

## Empty state

When no posts exist, the Dashboard renders «هنوز مطلبی در وبلاگ منتشر نشده
است.» — a designed empty state with no dead CTA.
