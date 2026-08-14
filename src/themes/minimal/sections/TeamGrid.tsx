// TeamGrid — meet-the-team cards with rounded portraits, subtle hover lift
// and a staggered entrance. Bio and link are optional per member.

import { ArrowUpRight } from 'lucide-react';
import { resolveMediaUrl } from '@/lib/api';
import type { SectionDefinition, SectionRenderProps } from '../../types';
import { colorOr } from '../../elementStyles';
import { StaggerGroup, StaggerItem } from '../../_motion';
import { SectionHeading } from './_shared/SectionHeading';

interface TeamMember {
  photo?: string;
  name?: string;
  role?: string;
  bio?: string;
  link_url?: string;
}

function clampColumns(n: unknown, fallback: number): number {
  const v = typeof n === 'number' ? n : fallback;
  return Math.max(2, Math.min(4, v));
}

function TeamGrid({ settings, content, locale }: SectionRenderProps) {
  const heading = (content.heading as string) || '';
  const subheading = (content.subheading as string) || '';
  const members = ((content.members as TeamMember[]) || []).filter((m) => m.name || m.photo);
  const columns = clampColumns(settings.columns, 3);

  // Per-element color overrides — each falls back to the active theme token.
  const nameColor = colorOr(settings.name_color, 'var(--theme-colors-text)');
  const roleColor = colorOr(settings.role_color, 'var(--theme-colors-primary)');
  const bioColor = colorOr(settings.bio_color, 'var(--theme-colors-muted)');
  const cardBgColor = colorOr(settings.card_bg_color, 'var(--theme-colors-surface)');
  const cardBorderColor = colorOr(settings.card_border_color, 'var(--theme-colors-border)');

  // Stay visible while empty so creators can see placement in the builder.
  if (members.length === 0) {
    return (
      <section className="py-12">
        <div
          className="text-center py-10 px-4"
          style={{
            border: '1px dashed var(--theme-colors-border)',
            borderRadius: 'var(--theme-radius-md)',
            color: 'var(--theme-colors-muted)',
          }}
        >
          <p className="text-sm">
            {locale === 'ar' ? 'لا يوجد أعضاء فريق بعد. أضف أعضاء من البيلدر.' : 'No team members yet. Add some from the builder.'}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-14 md:py-20">
      {(heading || subheading) && (
        <div className="mb-12">
          <SectionHeading
            heading={heading}
            subheading={subheading}
            align="center"
            headingColor={settings.heading_color}
            subheadingColor={settings.subheading_color}
          />
        </div>
      )}

      <StaggerGroup
        className="grid gap-6"
        style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${Math.floor(880 / columns)}px, 1fr))` }}
      >
        {members.map((m, i) => {
          const card = (
            <div
              className="card-lift flex flex-col items-center text-center gap-4 px-6 py-8 h-full"
              style={{
                backgroundColor: cardBgColor,
                border: `1px solid ${cardBorderColor}`,
                borderRadius: 'var(--theme-radius-lg)',
              }}
            >
              {m.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resolveMediaUrl(m.photo)}
                  alt={m.name || ''}
                  loading="lazy"
                  className="size-28 rounded-full object-cover"
                  style={{ boxShadow: 'var(--theme-shadow-sm)' }}
                />
              ) : (
                <div
                  className="size-28 rounded-full"
                  style={{ backgroundColor: cardBorderColor }}
                />
              )}
              <div className="flex flex-col gap-1">
                {m.name && (
                  <div
                    className="text-base font-semibold leading-tight inline-flex items-center justify-center gap-1"
                    style={{ color: nameColor, fontFamily: 'var(--theme-font-heading)' }}
                  >
                    {m.name}
                    {m.link_url && <ArrowUpRight className="size-4 opacity-50 rtl:-scale-x-100" />}
                  </div>
                )}
                {m.role && (
                  <div className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: roleColor }}>
                    {m.role}
                  </div>
                )}
              </div>
              {m.bio && (
                <p className="text-sm leading-relaxed" style={{ color: bioColor }}>
                  {m.bio}
                </p>
              )}
            </div>
          );

          return (
            <StaggerItem key={i} className="h-full">
              {m.link_url ? (
                <a href={m.link_url} className="block h-full" target="_blank" rel="noopener noreferrer">
                  {card}
                </a>
              ) : (
                card
              )}
            </StaggerItem>
          );
        })}
      </StaggerGroup>
    </section>
  );
}

export const teamGridSection: SectionDefinition = {
  schema: {
    id: 'team-grid',
    label: { en: 'Team Grid', ar: 'شبكة الفريق' },
    icon: 'users',
    category: 'content',
    description: {
      en: 'Meet-the-team cards with rounded portraits, name, role, bio and optional link.',
      ar: 'بطاقات تعريف بالفريق مع صور دائرية والاسم والصفة ونبذة ورابط اختياري.',
    },
    translatable: ['heading', 'subheading', 'members'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      { key: 'columns', type: 'number', label: { en: 'Columns', ar: 'الأعمدة' }, min: 2, max: 4, defaultValue: 3 },
      {
        key: 'members',
        type: 'repeater',
        label: { en: 'Team members', ar: 'أعضاء الفريق' },
        fields: [
          { key: 'photo', type: 'image', label: { en: 'Photo', ar: 'الصورة' } },
          { key: 'name', type: 'text', label: { en: 'Name', ar: 'الاسم' } },
          { key: 'role', type: 'text', label: { en: 'Role', ar: 'الصفة' } },
          { key: 'bio', type: 'textarea', label: { en: 'Short bio', ar: 'نبذة قصيرة' } },
          { key: 'link_url', type: 'url', label: { en: 'Link (optional)', ar: 'رابط (اختياري)' } },
        ],
      },
      { key: 'heading_color', type: 'color', label: { en: 'Heading color', ar: 'لون العنوان' } },
      { key: 'subheading_color', type: 'color', label: { en: 'Subheading color', ar: 'لون العنوان الفرعي' } },
      { key: 'name_color', type: 'color', label: { en: 'Name color', ar: 'لون الاسم' } },
      { key: 'role_color', type: 'color', label: { en: 'Role color', ar: 'لون الصفة' } },
      { key: 'bio_color', type: 'color', label: { en: 'Bio color', ar: 'لون النبذة' } },
      { key: 'card_bg_color', type: 'color', label: { en: 'Card background', ar: 'خلفية البطاقة' } },
      { key: 'card_border_color', type: 'color', label: { en: 'Card border', ar: 'حد البطاقة' } },
    ],
  },
  Component: TeamGrid,
  defaultSettings: { columns: 3 },
  defaultContent: {
    heading: 'Meet the team',
    subheading: 'The people behind the brand.',
    members: [
      { name: 'Alex Morgan', role: 'Founder', bio: 'Started the brand with a simple idea: quality first.' },
      { name: 'Dana Reeves', role: 'Head of Design', bio: 'Shapes every product from sketch to shelf.' },
      { name: 'Sami Haddad', role: 'Operations', bio: 'Keeps every order moving, every day.' },
    ],
  },
};
