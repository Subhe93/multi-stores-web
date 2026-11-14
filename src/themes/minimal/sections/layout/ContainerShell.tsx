import type { SectionRenderProps } from '../../../types';
import { containerClassFor, type ContainerChild } from './containerCss';

type CssBuilder = (sectionId: string, settings: Record<string, unknown>, children: ContainerChild[]) => string;

const EMPTY_LABEL: Record<string, string> = {
  en: 'Empty container. Add or drag sections here.',
  ar: 'حاوية فارغة. أضف الأقسام أو اسحبها إلى هنا.',
};

/**
 * Shared body of the layout containers: one scoped <style> plus the flex /
 * grid element holding the already rendered child wrappers. An empty
 * container shows a dashed placeholder in the builder preview only; on the
 * live store it renders nothing (the renderer skips it before this point).
 */
export function ContainerShell({
  kind,
  buildCss,
  settings,
  locale,
  sectionId,
  layoutChildren,
  builderPreview,
}: SectionRenderProps & { kind: 'row' | 'column' | 'grid'; buildCss: CssBuilder }) {
  const children = layoutChildren ?? [];
  if (!sectionId) return null;
  if (children.length === 0) {
    if (!builderPreview) return null;
    return (
      <div
        data-layout-empty={kind}
        style={{
          minHeight: 96,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 16,
          border: '2px dashed var(--theme-colors-border)',
          borderRadius: 'var(--theme-radius-md)',
          color: 'var(--theme-colors-muted)',
          fontSize: 14,
          textAlign: 'center',
        }}
      >
        {EMPTY_LABEL[locale] ?? EMPTY_LABEL.en}
      </div>
    );
  }
  const css = buildCss(
    sectionId,
    settings,
    children.map((c) => ({ id: c.id, layout: c.layout, divider: c.divider })),
  );
  return (
    <>
      {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
      <div className={containerClassFor(sectionId)} data-layout={kind}>
        {children.map((c) => c.node)}
      </div>
    </>
  );
}
