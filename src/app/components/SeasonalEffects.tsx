import { motion } from 'motion/react';
import { Snowflake, Leaf, Sparkles, Sun } from 'lucide-react';
import { useStore } from '@/app/context/StoreContext';

export function SeasonalEffects() {
    const { theme } = useStore();
    const seasonal = theme.seasonal;

    if (!seasonal || !seasonal.active || !seasonal.showEffects) return null;

    const getIcon = () => {
        switch (seasonal.type) {
            case 'Winter': return Snowflake;
            case 'Autumn': return Leaf;
            case 'Spring': return Sparkles;
            case 'Summer': return Sun;
            default: return Snowflake;
        }
    };

    const getColor = () => {
        switch (seasonal.type) {
            case 'Winter': return 'text-blue-200/40';
            case 'Autumn': return 'text-orange-400/30';
            case 'Spring': return 'text-pink-300/40';
            case 'Summer': return 'text-amber-200/30';
            default: return 'text-white/20';
        }
    };

    const Icon = getIcon();

    return (
        <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
            {[...Array(20)].map((_, i) => (
                <motion.div
                    key={i}
                    initial={{
                        top: -50,
                        left: `${Math.random() * 100}%`,
                        opacity: 0,
                        rotate: 0,
                        scale: 0.5 + Math.random()
                    }}
                    animate={{
                        top: '110%',
                        left: `${(Math.random() * 100) + (Math.random() * 20 - 10)}%`,
                        opacity: [0, 1, 1, 0],
                        rotate: 360,
                    }}
                    transition={{
                        duration: 8 + Math.random() * 7,
                        repeat: Infinity,
                        delay: Math.random() * 20,
                        ease: "linear"
                    }}
                    className="absolute"
                >
                    <Icon className={`w-4 h-4 sm:w-6 sm:h-6 ${getColor()}`} />
                </motion.div>
            ))}
        </div>
    );
}
