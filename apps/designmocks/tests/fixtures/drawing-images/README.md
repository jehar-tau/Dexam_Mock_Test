# Fictional raster fixtures

These tiny colour grids are original software test fixtures. They contain no
student data or question-bank content. The three `fictional-drawing.*` files
contain the literal marker `DMOCKS_FICTIONAL_PRIVATE_METADATA_2026`, a fictional
author/software description and EXIF orientation 6. The PNG also has a text
comment. Displaying them with the orientation applied gives a 4-by-6 image.

The remaining files cover alpha, a transparent palette, 16-bit PNG samples,
progressive JPEG, lossy/lossless WebP, standard sRGB profiles and two-frame
animations. They were generated from the same 6-by-4 RGB grid using Pillow.
They are used only by tests and are never public application assets. Tests
compare decoded, oriented pixels and preserve the compressed sample streams;
they do not rely on screenshots or a decoder accepting the header alone.

`orientation-pixels.json` records independently Pillow-decoded RGB samples for
all eight orientations of each original format. Browser screenshots compare
against those pixels, including formats whose native renderer ignores EXIF.
`transparent-ink.png` is an original 2-by-2 white/transparent drawing used to
verify contrasting inspection backgrounds. Neither contains private content.
