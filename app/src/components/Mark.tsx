import { Image } from '@mantine/core'

/**
 * The Tomely mark, in the version that suits the colour scheme it is sitting
 * on: the light one has a near-black middle bar, the dark one a white one.
 *
 * Both files are in the markup and CSS hides one, rather than picking in
 * JavaScript. `ColorSchemeScript` puts `data-mantine-color-scheme` on <html>
 * before the first paint, so this settles without a flash - and without the
 * server having to know a reader's theme, which it cannot.
 *
 * Decorative by default: everywhere it appears, the word "Tomely" is next to
 * it. Pass `alt` where it stands alone.
 */
export function Mark({
  size,
  alt = '',
}: Readonly<{ size: number; alt?: string }>) {
  return (
    <>
      <Image src="/mark-light.png" alt={alt} w={size} h={size} darkHidden />
      <Image src="/mark-dark.png" alt={alt} w={size} h={size} lightHidden />
    </>
  )
}
