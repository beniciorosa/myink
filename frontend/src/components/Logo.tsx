
import React from 'react';
import logoImg from '../assets/logo.png';

const Logo: React.FC = () => {
    return (
        <div className="flex items-center">
            <div className="w-14 h-14 flex items-center justify-center overflow-hidden">
                <img
                    src={logoImg}
                    alt="myInk Logo"
                    className="w-full h-full object-contain"
                />
            </div>
        </div>
    );
};

export default Logo;
