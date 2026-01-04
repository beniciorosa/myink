
import React from 'react';
import logoImg from '../assets/logo.png';

const Logo: React.FC = () => {
    return (
        <div className="flex items-center space-x-2">
            <div className="w-10 h-10 flex items-center justify-center overflow-hidden">
                <img
                    src={logoImg}
                    alt="myInk Logo"
                    className="w-full h-full object-contain"
                />
            </div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                my<span className="text-blue-600 dark:text-blue-400">Ink</span>
            </h1>
        </div>
    );
};

export default Logo;
