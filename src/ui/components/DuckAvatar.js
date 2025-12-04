export const DuckAvatar = {
    getSVG(config) {
        return `
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <g transform="scale(-1, 1) translate(-100, 0)">
                <path d="M20,60 Q20,90 50,90 L75,90 Q95,90 95,70 Q95,50 75,50 L70,50 L70,40 Q70,10 45,10 Q20,10 20,40 L20,60 Z" fill="${config.body}" stroke="#333" stroke-width="2"/>
                <path d="M40,65 Q50,85 70,65" fill="none" stroke="${config.beak}" stroke-width="3" stroke-linecap="round" />
                <circle cx="40" cy="30" r="5" fill="white" />
                <circle cx="42" cy="30" r="2" fill="black" />
                <path d="M20,35 Q5,35 5,45 Q5,50 20,45 Z" fill="${config.beak}" stroke="#333" stroke-width="1"/>
            </g>
        </svg>`;
    },
};
