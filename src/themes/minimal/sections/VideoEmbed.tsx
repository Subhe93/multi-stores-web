// Definition file — see FaqList.tsx for the RSC boundary rationale.

import type { SectionDefinition } from '../../types';
import { VideoEmbed } from './VideoEmbed.client';

export const videoEmbedSection: SectionDefinition = {
  schema: {
    id: 'video',
    label: { en: 'Video', ar: 'فيديو' },
    icon: 'video',
    category: 'content',
    description: {
      en: 'Embed a YouTube/Vimeo video or a direct file. Optional poster image with a play overlay.',
      ar: 'تضمين فيديو يوتيوب/فيميو أو ملف مباشر. صورة غلاف اختيارية مع زر تشغيل.',
    },
    translatable: ['heading', 'subheading'],
    schema: [
      { key: 'heading', type: 'text', label: { en: 'Heading', ar: 'العنوان' } },
      { key: 'subheading', type: 'textarea', label: { en: 'Subheading', ar: 'العنوان الفرعي' } },
      { key: 'video_url', type: 'url', label: { en: 'Video URL (YouTube, Vimeo, or .mp4)', ar: 'رابط الفيديو (يوتيوب، فيميو، أو .mp4)' } },
      { key: 'poster', type: 'image', label: { en: 'Poster image (optional)', ar: 'صورة الغلاف (اختياري)' } },
      {
        key: 'aspect_ratio',
        type: 'select',
        label: { en: 'Aspect ratio', ar: 'نسبة الأبعاد' },
        defaultValue: '16/9',
        options: [
          { value: '16/9', label: { en: '16:9 (widescreen)', ar: '16:9 (عريض)' } },
          { value: '4/3', label: { en: '4:3', ar: '4:3' } },
          { value: '1/1', label: { en: '1:1 (square)', ar: '1:1 (مربّع)' } },
          { value: '9/16', label: { en: '9:16 (vertical)', ar: '9:16 (عمودي)' } },
        ],
      },
      { key: 'heading_color', type: 'color', label: { en: 'Heading color', ar: 'لون العنوان' } },
      { key: 'subheading_color', type: 'color', label: { en: 'Subheading color', ar: 'لون العنوان الفرعي' } },
    ],
  },
  Component: VideoEmbed,
  defaultSettings: { aspect_ratio: '16/9' },
};
