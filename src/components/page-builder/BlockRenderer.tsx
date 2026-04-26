'use client';

import { BeforeAfterBlock } from './BeforeAfterBlock';

interface Block {
  id: string;
  type: string;
  settings: any;
  translations: { locale: string; content: any }[];
}

interface BlockRendererProps {
  blocks: Block[];
  locale?: string;
}

export function BlockRenderer({ blocks, locale = 'en' }: BlockRendererProps) {
  return (
    <div className="space-y-8">
      {blocks.map((block) => {
        const content = block.translations.find((t) => t.locale === locale)?.content
          || block.translations[0]?.content
          || {};

        return (
          <div key={block.id}>
            {renderBlock(block.type, content, block.settings)}
          </div>
        );
      })}
    </div>
  );
}

function renderBlock(type: string, content: any, settings: any) {
  switch (type) {
    case 'HERO':
      return (
        <section className="py-16 text-center" style={{ backgroundColor: settings?.bgColor || '#f8fafc' }}>
          {content.image && <img src={content.image} alt="" className="mx-auto mb-6 max-h-80 object-cover rounded-lg" />}
          <h2 className="text-3xl font-bold mb-4">{content.heading || ''}</h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">{content.subheading || ''}</p>
          {content.buttonText && (
            <a href={content.buttonUrl || '#'} className="inline-block mt-6 px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
              {content.buttonText}
            </a>
          )}
        </section>
      );

    case 'TEXT':
      return (
        <div className="prose prose-lg max-w-none">
          <div dangerouslySetInnerHTML={{ __html: content.html || content.text || '' }} />
        </div>
      );

    case 'IMAGE':
      return (
        <div className="text-center">
          <img src={content.url || ''} alt={content.alt || ''} className="mx-auto rounded-lg max-w-full" />
          {content.caption && <p className="text-sm text-gray-500 mt-2">{content.caption}</p>}
        </div>
      );

    case 'GALLERY':
      return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {(content.images || []).map((img: any, i: number) => (
            <img key={i} src={img.url} alt={img.alt || ''} className="rounded-lg aspect-square object-cover" />
          ))}
        </div>
      );

    case 'VIDEO':
      return (
        <div className="aspect-video">
          <iframe
            src={content.url || ''}
            className="w-full h-full rounded-lg"
            allowFullScreen
          />
        </div>
      );

    case 'FAQ':
      return (
        <div className="space-y-4">
          <h3 className="text-2xl font-bold">{content.heading || 'FAQ'}</h3>
          {(content.items || []).map((item: any, i: number) => (
            <details key={i} className="border rounded-lg p-4">
              <summary className="font-medium cursor-pointer">{item.question}</summary>
              <p className="mt-2 text-gray-600">{item.answer}</p>
            </details>
          ))}
        </div>
      );

    case 'CTA':
      return (
        <section className="bg-blue-600 text-white rounded-xl p-12 text-center">
          <h3 className="text-2xl font-bold mb-4">{content.heading || ''}</h3>
          <p className="mb-6 text-blue-100">{content.subheading || ''}</p>
          {content.buttonText && (
            <a href={content.buttonUrl || '#'} className="inline-block px-8 py-3 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50">
              {content.buttonText}
            </a>
          )}
        </section>
      );

    case 'REVIEWS':
      return (
        <div className="space-y-4">
          <h3 className="text-2xl font-bold">{content.heading || 'Reviews'}</h3>
          {(content.reviews || []).map((review: any, i: number) => (
            <div key={i} className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-medium">{review.name}</span>
                <span className="text-yellow-500">{'★'.repeat(review.rating || 5)}</span>
              </div>
              <p className="text-gray-600">{review.text}</p>
            </div>
          ))}
        </div>
      );

    case 'BEFORE_AFTER':
      return <BeforeAfterBlock content={content} />;

    case 'SPACER':
      return <div style={{ height: settings?.height || 40 }} />;

    default:
      return <div className="text-gray-400 text-sm">Unknown block type: {type}</div>;
  }
}
