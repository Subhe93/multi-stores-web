// One creative stylesheet, rendered where it is used. React 19 hoists a
// <style> with `href` + `precedence` into <head> and dedupes it by href, on
// the server and in the client-rendered builder preview alike, so ten
// sections on a page still ship the base rules once.

export function CxStyle({ id, css }: { id: string; css: string }) {
  if (!css) return null;
  return (
    <style href={`cx-${id}`} precedence="cx">
      {css}
    </style>
  );
}
