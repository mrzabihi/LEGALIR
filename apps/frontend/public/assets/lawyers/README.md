# Demo lawyer portraits

Synthetic / generated portraits for the seeded demo lawyers. These are
**not** photographs of the named people — the names are real, the faces are
generated. The card marks every one of these profiles with the «نمونه»
badge and `avatarType: "demo"`.

## Expected files

| File | Profile |
| --- | --- |
| `lawyer-demo-ali-zabihi.webp` | علی ذبیحی — male, ~39, calm professional |
| `lawyer-demo-mahdieh-farsaei.webp` | مهدیه فرسایی — female, ~35, curly hair |
| `lawyer-demo-hesam-saki.webp` | حسام ساکی — male, ~30, black beard |
| `lawyer-demo-mohadeseh-rezaei.webp` | محدثه رضایی — female, ~20, curly hair |
| `lawyer-demo-nahid-abdollahi.webp` | ناهید عبدالهی — female, ~25, short hair |
| `lawyer-demo-ali-shokri.webp` | علی شکری — male, ~40, bald, long beard |
| `lawyer-demo-farbod-saleh.webp` | فربد صالح — male, criminal defence |
| `lawyer-demo-farshin-ganji.webp` | فرشین گنجی — male, immigration |
| `lawyer-demo-mehdi-esmaeili.webp` | مهدی اسمعیلی — male, labour |

## Requirements

- Square, head-and-shoulders, neutral professional background.
- WebP (or AVIF), ~256×256, optimized — the card renders at 72px.
- Photorealistic but clearly synthetic. No cartoon / emoji / 3D avatars.

## Until the files exist

The card falls back to an initials chip (e.g. «ع ذ») — it never shows a
broken image. Dropping the files in this directory is all that is needed;
no code change is required.

## Replacing with real portraits

When a lawyer supplies a consented, verified photograph, set
`avatarUrl` to the new asset and `avatarType` to `"real"` on their
`LawyerProfile` row. The card then drops the demo treatment for that
profile automatically.
