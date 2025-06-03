declare global {
    function isNaN(number: number | string): boolean;
    function parseInt(number: string | number, radix?: number): number;
}

export {};