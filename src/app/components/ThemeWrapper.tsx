import { useEffect } from 'react';
import { useStore } from '@/app/context/StoreContext';

export function ThemeWrapper({ children }: { children: React.ReactNode }) {
    const { theme } = useStore();

    useEffect(() => {
        const root = document.documentElement;

        // Apply Colors
        root.style.setProperty('--primary-color', theme.primaryColor);
        root.style.setProperty('--accent-color', theme.accentColor);

        // Apply Typography
        const fontStack = {
            'Inter': '"Inter", sans-serif',
            'Roboto': '"Roboto", sans-serif',
            'Outfit': '"Outfit", sans-serif',
            'Playfair Display': '"Playfair Display", serif'
        };
        root.style.setProperty('--font-family', fontStack[theme.fontFamily || 'Outfit']);

        const fontSizeMap = {
            'Small': '14px',
            'Medium': '16px',
            'Large': '18px'
        };
        root.style.setProperty('--base-font-size', fontSizeMap[theme.baseFontSize || 'Medium']);

        // Apply Button Style
        const radiusMap = {
            'Rounded': '8px',
            'Square': '0px',
            'Pill': '9999px'
        };
        root.style.setProperty('--button-radius', radiusMap[theme.buttonStyle || 'Pill']);

        // Base radius for containers (capped for Pill to avoid huge ovals on large blocks)
        const baseRadiusMap = {
            'Rounded': '12px',
            'Square': '0px',
            'Pill': '28px'
        };
        root.style.setProperty('--base-radius', baseRadiusMap[theme.buttonStyle || 'Pill']);

        // Apply Layout Spacing
        const spacingMap = {
            'Compact': '0.75',
            'Normal': '1',
            'Loose': '1.5'
        };
        root.style.setProperty('--layout-spacing-mult', spacingMap[theme.layoutSpacing || 'Normal']);

        // Dark Mode
        if (theme.isDarkMode) {
            root.classList.add('dark');
        } else {
            root.classList.remove('dark');
        }

        // Favicon
        if (theme.faviconUrl) {
            let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
            if (!link) {
                link = document.createElement('link');
                link.rel = 'icon';
                document.getElementsByTagName('head')[0].appendChild(link);
            }
            link.href = theme.faviconUrl;
        }

        // Store Name / Title
        document.title = theme.storeName || 'The Fruit Tribe';

    }, [theme]);

    return <div className="theme-wrapper font-custom antialiased">{children}</div>;
}
