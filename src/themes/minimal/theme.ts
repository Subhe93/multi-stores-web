import type { Theme } from '../types';
import { minimalTokens } from './tokens';
import { MinimalLayout } from './Layout';
import { heroBannerSection } from './sections/HeroBanner';
import { heroSliderSection } from './sections/HeroSlider';
import { auroraHeroSection } from './sections/AuroraHero';
import { heroVideoSection } from './sections/HeroVideo';
import { parallaxBannerSection } from './sections/ParallaxBanner';
import { beforeAfterSection } from './sections/BeforeAfter';
import { imageHotspotsSection } from './sections/ImageHotspots';
import { masonryGallerySection } from './sections/MasonryGallery';
import { bentoGridSection } from './sections/BentoGrid';
import { animatedFeaturesSection } from './sections/AnimatedFeatures';
import { marqueeTextSection } from './sections/MarqueeText';
import { richTextSection } from './sections/RichText';
import { imageGallerySection } from './sections/ImageGallery';
import { gallerySliderSection } from './sections/GallerySlider';
import { faqListSection } from './sections/FaqList';
import { callToActionSection } from './sections/CallToAction';
import { imageWithTextSection } from './sections/ImageWithText';
import { trustBadgesSection } from './sections/TrustBadges';
import { newsletterSignupSection } from './sections/NewsletterSignup';
import { socialIconsSection } from './sections/SocialIcons';
import { headerBarSection } from './sections/chrome/HeaderBar';
import { footerColumnsSection } from './sections/chrome/FooterColumns';
import { copyrightBarSection } from './sections/chrome/CopyrightBar';
import { announcementBarSection } from './sections/chrome/AnnouncementBar';
import { megaMenuSection } from './sections/chrome/MegaMenu';
import { mobileBottomNavSection } from './sections/chrome/MobileBottomNav';
import { testimonialsSection } from './sections/Testimonials';
import { heroSplitSection } from './sections/HeroSplit';
import { testimonialCarouselSection } from './sections/TestimonialCarousel';
import { teamGridSection } from './sections/TeamGrid';
import { timelineSection } from './sections/Timeline';
import { pricingTableSection } from './sections/PricingTable';
import { quoteBannerSection } from './sections/QuoteBanner';
import { logoListSection } from './sections/LogoList';
import { logoMarqueeSection } from './sections/LogoMarquee';
import { stickyCtaBarSection } from './sections/StickyCtaBar';
import { statsBarSection } from './sections/StatsBar';
import { featureGridSection } from './sections/FeatureGrid';
import { stepsSection } from './sections/Steps';
import { comparisonTableSection } from './sections/ComparisonTable';
import { spacerSection } from './sections/Spacer';
import { countdownSection } from './sections/Countdown';
import { videoEmbedSection } from './sections/VideoEmbed';
import { layoutColumnsSection } from './sections/LayoutColumns';
import { embedCodeSection } from './sections/EmbedCode';
import { mapSection } from './sections/MapSection';
import { featuredProductsSection } from './sections/FeaturedProducts';
import { productSliderSection } from './sections/ProductSlider';
import { collectionProductsSection } from './sections/CollectionProducts';
import { productPageMagicSection } from './sections/product/ProductPageMagic';
import { productGalleryMagicSection } from './sections/product/ProductGalleryMagic';
import { productDetailsMagicSection } from './sections/product/ProductDetailsMagic';
import { productTabsMagicSection } from './sections/product/ProductTabsMagic';
import { addToCartMagicSection } from './sections/product/AddToCartMagic';
import { productListingMagicSection } from './sections/listing/ProductListingMagic';

export const minimalTheme: Theme = {
  key: 'minimal',
  label: { en: 'Minimal', ar: 'بسيط' },
  description: {
    en: 'Clean, spacious layout with serif headings. Suits boutique and editorial brands.',
    ar: 'تصميم بسيط ومريح للعين مع عناوين بخط Serif. يناسب العلامات البوتيكية والتحريرية.',
  },
  tokens: minimalTokens,
  Layout: MinimalLayout,
  sections: {
    // Generic content/showcase sections — work on any page type.
    'hero-banner': heroBannerSection,
    'hero-slider': heroSliderSection,
    'aurora-hero': auroraHeroSection,
    'hero-video': heroVideoSection,
    'parallax-banner': parallaxBannerSection,
    'before-after': beforeAfterSection,
    'image-hotspots': imageHotspotsSection,
    'masonry-gallery': masonryGallerySection,
    'bento-grid': bentoGridSection,
    'animated-features': animatedFeaturesSection,
    'marquee-text': marqueeTextSection,
    'rich-text': richTextSection,
    'image-gallery': imageGallerySection,
    'gallery-slider': gallerySliderSection,
    'image-with-text': imageWithTextSection,
    'faq-list': faqListSection,
    'call-to-action': callToActionSection,
    'trust-badges': trustBadgesSection,
    'testimonials': testimonialsSection,
    'hero-split': heroSplitSection,
    'testimonial-carousel': testimonialCarouselSection,
    'team-grid': teamGridSection,
    'timeline': timelineSection,
    'pricing-table': pricingTableSection,
    'quote-banner': quoteBannerSection,
    'logo-list': logoListSection,
    'logo-marquee': logoMarqueeSection,
    'sticky-cta-bar': stickyCtaBarSection,
    'stats-bar': statsBarSection,
    'feature-grid': featureGridSection,
    'steps': stepsSection,
    'comparison-table': comparisonTableSection,
    'countdown': countdownSection,
    'video': videoEmbedSection,
    'spacer': spacerSection,
    'layout-columns': layoutColumnsSection,
    'embed-code': embedCodeSection,
    'map': mapSection,
    'newsletter-signup': newsletterSignupSection,
    'social-icons': socialIconsSection,
    // Curated product list — works on HOME/LANDING (fetches from API).
    'featured-products': featuredProductsSection,
    'product-slider': productSliderSection,
    'collection-products': collectionProductsSection,
    // Magic sections — read from product context, only useful on PRODUCT_TEMPLATE.
    // `product-page` is the full-fidelity body (matches the standalone design);
    // the granular ones below remain for backward-compat with older templates.
    'product-page': productPageMagicSection,
    'product-gallery': productGalleryMagicSection,
    'product-details': productDetailsMagicSection,
    'product-tabs': productTabsMagicSection,
    'add-to-cart': addToCartMagicSection,
    // Listing magic section — reads from the listing context injected by the
    // /products and /collections/[handle] routes. Only useful on
    // CATALOG_TEMPLATE / COLLECTION_TEMPLATE (scoped via schema.pageTypes).
    'product-listing': productListingMagicSection,
    // Chrome sections — restricted to HEADER/FOOTER pages via schema.pageTypes.
    'header-bar': headerBarSection,
    'footer-columns': footerColumnsSection,
    'copyright-bar': copyrightBarSection,
    'announcement-bar': announcementBarSection,
    'mega-menu': megaMenuSection,
    'mobile-bottom-nav': mobileBottomNavSection,
  },
  defaultHomeSections: [
    {
      section_key: 'hero-banner',
      settings: { layout: 'centered', alignment: 'center' },
      content: {
        heading: 'Welcome to our store',
        subheading: 'Discover our latest collection',
        cta_text: 'Shop now',
      },
    },
    {
      section_key: 'featured-products',
      settings: { filter: 'newest', limit: 4, columns: 4 },
      content: { heading: 'New arrivals' },
    },
    {
      section_key: 'trust-badges',
      settings: { layout: 'cards' },
      content: {
        items: [
          { icon: 'truck', label: 'Free shipping' },
          { icon: 'refresh', label: 'Easy returns' },
          { icon: 'shield', label: 'Secure payment' },
        ],
      },
    },
  ],
};
