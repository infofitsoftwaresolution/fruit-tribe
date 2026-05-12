declare module 'react-responsive-masonry' {
    import * as React from 'react';

    export interface ResponsiveMasonryProps {
        columnsCountBreakPoints?: { [key: number]: number };
        children?: React.ReactNode;
    }

    export class ResponsiveMasonry extends React.Component<ResponsiveMasonryProps> {}

    export interface MasonryProps {
        columnsCount?: number;
        gutter?: string;
        children?: React.ReactNode;
        className?: string;
        style?: React.CSSProperties;
    }

    export default class Masonry extends React.Component<MasonryProps> {}
}
