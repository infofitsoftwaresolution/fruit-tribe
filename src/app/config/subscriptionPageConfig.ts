/** Editable content for the public `/subscription` page. Stored in `preferences.subscriptionPage`. */

export type SubscriptionFrequency = 'Weekly' | 'Bi-weekly' | 'Monthly';

export interface SubscriptionPlanConfig {
    id: string;
    name: string;
    price: number;
    period: string;
    frequency: SubscriptionFrequency;
    description: string;
    features: string[];
    popular: boolean;
}

export interface SubscriptionFruitConfig {
    name: string;
    category: string;
    score: number;
}

export type SubscriptionBenefitIcon = 'gift' | 'truck' | 'calendar';

export interface SubscriptionBenefitConfig {
    icon: SubscriptionBenefitIcon;
    title: string;
    desc: string;
    color: 'emerald' | 'blue' | 'purple';
}

export interface SubscriptionPageConfig {
    /** When false, `/subscription` is hidden and nav/CTAs do not link to it. */
    enabled: boolean;
    badgeLabel: string;
    heroPrefix: string;
    heroGradientText: string;
    heroSubtitle: string;
    plans: SubscriptionPlanConfig[];
    fruits: SubscriptionFruitConfig[];
    deliveryDays: string[];
    customizeEyebrow: string;
    customizeTitle: string;
    customizeSubtitle: string;
    benefits: SubscriptionBenefitConfig[];
}

export function getDefaultSubscriptionPageConfig(): SubscriptionPageConfig {
    return {
        enabled: true,
        badgeLabel: 'Member Plans',
        heroPrefix: 'Join the',
        heroGradientText: 'Fruit Tribe',
        heroSubtitle: 'Get hand-picked fruits delivered to your home on your schedule.',
        plans: [
            {
                id: 'Weekly Box',
                name: 'Weekly Box',
                price: 499,
                period: 'per week',
                frequency: 'Weekly',
                description: 'Perfect for individuals or small families',
                features: [
                    '3-4kg of fresh fruits',
                    'Weekly delivery',
                    'Free shipping',
                    'Customizable selection',
                    'Mix of seasonal fruits',
                ],
                popular: false,
            },
            {
                id: 'Premium Tribe',
                name: 'Premium Tribe',
                price: 1499,
                period: 'per month',
                frequency: 'Monthly',
                description: 'Great for regular fruit lovers',
                features: [
                    '10-12kg of fresh fruits',
                    'Choose delivery days',
                    'Free priority shipping',
                    'Cancel anytime',
                    'Premium exotic selection',
                    'Recipe cards included',
                ],
                popular: true,
            },
            {
                id: 'Family Feast',
                name: 'Family Feast',
                price: 2499,
                period: 'per month',
                frequency: 'Bi-weekly',
                description: 'Best value for large families',
                features: [
                    '20-25kg of fresh fruits',
                    'Bi-weekly delivery',
                    'Free priority shipping',
                    'Full custom control',
                    'Premium & exotic fruits',
                    'Dedicated account manager',
                ],
                popular: false,
            },
        ],
        fruits: [
            { name: 'Alphonso Mango', category: 'Premium', score: 98 },
            { name: 'Organic Strawberries', category: 'Berries', score: 95 },
            { name: 'Wild Blueberries', category: 'Berries', score: 92 },
            { name: 'Nagpur Oranges', category: 'Citrus', score: 94 },
            { name: 'Kashmiri Apples', category: 'Core', score: 90 },
            { name: 'Organic Watermelon', category: 'Hydration', score: 88 },
            { name: 'Golden Kiwi', category: 'Exotic', score: 96 },
            { name: 'Maui Pineapple', category: 'Tropical', score: 93 },
            { name: 'Emerald Grapes', category: 'Vines', score: 89 },
            { name: 'Ruby Pomegranate', category: 'Superfood', score: 97 },
        ],
        deliveryDays: ['Monday', 'Wednesday', 'Friday', 'Saturday'],
        customizeEyebrow: 'Customize',
        customizeTitle: 'Customize Your Box',
        customizeSubtitle:
            'Select varieties to cycle in your weekly drop. Delivery days are scheduled for next week, not the current week.',
        benefits: [
            {
                icon: 'gift',
                title: 'Better Prices',
                desc: 'Save more with recurring deliveries and plan pricing.',
                color: 'emerald',
            },
            {
                icon: 'truck',
                title: 'Farm to Home',
                desc: 'Fresh fruits delivered quickly from trusted sources.',
                color: 'blue',
            },
            {
                icon: 'calendar',
                title: 'Flexible Schedule',
                desc: 'Pause, resume, or update deliveries anytime.',
                color: 'purple',
            },
        ],
    };
}

export function mergeSubscriptionPageConfig(
    partial?: SubscriptionPageConfig | null,
): SubscriptionPageConfig {
    const d = getDefaultSubscriptionPageConfig();
    if (!partial || typeof partial !== 'object') return d;
    return {
        enabled: partial.enabled !== false,
        badgeLabel: partial.badgeLabel ?? d.badgeLabel,
        heroPrefix: partial.heroPrefix ?? d.heroPrefix,
        heroGradientText: partial.heroGradientText ?? d.heroGradientText,
        heroSubtitle: partial.heroSubtitle ?? d.heroSubtitle,
        plans: Array.isArray(partial.plans) && partial.plans.length > 0 ? partial.plans : d.plans,
        fruits: Array.isArray(partial.fruits) && partial.fruits.length > 0 ? partial.fruits : d.fruits,
        deliveryDays:
            Array.isArray(partial.deliveryDays) && partial.deliveryDays.length > 0
                ? partial.deliveryDays
                : d.deliveryDays,
        customizeEyebrow: partial.customizeEyebrow ?? d.customizeEyebrow,
        customizeTitle: partial.customizeTitle ?? d.customizeTitle,
        customizeSubtitle: partial.customizeSubtitle ?? d.customizeSubtitle,
        benefits:
            Array.isArray(partial.benefits) && partial.benefits.length > 0 ? partial.benefits : d.benefits,
    };
}
