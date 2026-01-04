import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, Upload, Type, X, AlertCircle, Loader2, Wand2 } from 'lucide-react';
import { ocrIsbn } from '../services/apiService';

interface BarcodeScannerProps {
    onScanSuccess: (decodedText: string) => void;
    onClose: () => void;
}

export const BarcodeScanner = ({ onScanSuccess, onClose }: BarcodeScannerProps) => {
    const [mode, setMode] = useState<'camera' | 'upload' | 'manual'>('camera');
    const [error, setError] = useState<string | null>(null);
    const [isScanning, setIsScanning] = useState(false);
    const [manualIsbn, setManualIsbn] = useState('');
    const [uploading, setUploading] = useState(false);

    const scannerRef = useRef<Html5Qrcode | null>(null);
    const isTransitioning = useRef(false);
    const cameraContainerId = "qr-reader";

    const stopCamera = async () => {
        if (isTransitioning.current) return;
        if (scannerRef.current && scannerRef.current.isScanning) {
            isTransitioning.current = true;
            try {
                await scannerRef.current.stop();
            } catch (err) {
                console.error("Erro ao parar câmera:", err);
            } finally {
                isTransitioning.current = false;
            }
        }
    };

    const startCamera = async () => {
        if (isTransitioning.current) return;
        setError(null);
        setIsScanning(true);

        if (!scannerRef.current) {
            scannerRef.current = new Html5Qrcode(cameraContainerId);
        }

        isTransitioning.current = true;
        try {
            await scannerRef.current.start(
                { facingMode: "environment" },
                {
                    fps: 20,
                    qrbox: (viewfinderWidth, viewfinderHeight) => {
                        const minEdgeSize = Math.min(viewfinderWidth, viewfinderHeight);
                        const qrboxSize = Math.floor(minEdgeSize * 0.8);
                        return {
                            width: qrboxSize,
                            height: Math.floor(qrboxSize * 0.6)
                        };
                    },
                    aspectRatio: 1.0,
                    formatsToSupport: [
                        Html5QrcodeSupportedFormats.EAN_13,
                        Html5QrcodeSupportedFormats.EAN_8,
                        Html5QrcodeSupportedFormats.CODE_128
                    ]
                },
                (decodedText) => {
                    onScanSuccess(decodedText);
                    stopCamera();
                },
                () => { }
            );
        } catch (err: any) {
            console.error("Erro ao iniciar câmera:", err);
            setError("Não foi possível acessar a câmera. Tente subir uma foto ou digitar o ISBN.");
            setIsScanning(false);
        } finally {
            isTransitioning.current = false;
        }
    };

    useEffect(() => {
        if (mode === 'camera') {
            startCamera();
        } else {
            stopCamera();
        }
        return () => {
            stopCamera();
        };
    }, [mode]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setError(null);
        setUploading(true);

        if (!scannerRef.current) {
            scannerRef.current = new Html5Qrcode(cameraContainerId);
        }

        try {
            await stopCamera();
            try {
                const decodedText = await scannerRef.current.scanFile(file, true);
                onScanSuccess(decodedText);
            } catch (err) {
                const reader = new FileReader();
                const base64Promise = new Promise<string>((resolve) => {
                    reader.onload = () => resolve(reader.result as string);
                    reader.readAsDataURL(file);
                });
                const base64 = await base64Promise;

                const aiIsbn = await ocrIsbn(base64);
                if (aiIsbn) {
                    onScanSuccess(aiIsbn);
                } else {
                    throw new Error("IA não encontrou ISBN");
                }
            }
        } catch (err) {
            setError("Não encontramos o código de barras. Tente digitar ou outra foto.");
        } finally {
            setUploading(false);
        }
    };

    const handleAIFallback = async () => {
        if (!scannerRef.current || !scannerRef.current.isScanning) return;
        setError(null);
        setUploading(true);
        try {
            const video = document.querySelector(`#${cameraContainerId} video`) as HTMLVideoElement;
            if (video) {
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = video.videoWidth;
                tempCanvas.height = video.videoHeight;
                tempCanvas.getContext('2d')?.drawImage(video, 0, 0);
                const base64 = tempCanvas.toDataURL('image/jpeg');
                await stopCamera();
                const aiIsbn = await ocrIsbn(base64);
                if (aiIsbn) onScanSuccess(aiIsbn);
                else setError("IA não conseguiu ler este código.");
            }
        } catch (err) {
            setError("Erro ao processar imagem.");
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div onClick={onClose} className="absolute inset-0 bg-gray-950/80 backdrop-blur-sm" />
            <div className="bg-white dark:bg-gray-800 rounded-3xl overflow-hidden w-full max-w-lg shadow-2xl relative flex flex-col max-h-[90vh] border border-gray-200 dark:border-gray-700 animate-fade-in">

                {/* Header */}
                <div className="p-6 pb-2 flex justify-between items-start">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white">Buscar por ISBN</h3>
                        <p className="text-gray-500 text-xs mt-1">Capture o código de barras ou digite o número.</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors">
                        <X size={20} className="text-gray-400" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="px-6 my-4">
                    <div className="flex p-1 bg-gray-100 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-gray-700">
                        {[
                            { id: 'camera', label: 'Câmera', icon: Camera },
                            { id: 'upload', label: 'Foto', icon: Upload },
                            { id: 'manual', label: 'Digitar', icon: Type },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setMode(tab.id as any)}
                                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${mode === tab.id ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                            >
                                <tab.icon size={14} />
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Content */}
                <div className="px-6 pb-8">
                    {mode === 'camera' && (
                        <div className="relative rounded-2xl overflow-hidden bg-black aspect-square max-h-[350px] w-full border border-gray-200 dark:border-gray-700">
                            {/* Scanner container must stay in DOM for Html5Qrcode to work in upload mode */}
                            <div id={cameraContainerId} className="w-full h-full"></div>

                            {isScanning && (
                                <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                                    <div className="w-[80%] h-[40%] border border-blue-400/50 rounded-lg relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-full h-0.5 bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.8)] animate-scan-line"></div>
                                    </div>
                                    <p className="text-white text-[10px] uppercase font-bold tracking-widest mt-6 opacity-60">Posicione o código no centro</p>
                                </div>
                            )}
                            {isScanning && (
                                <button
                                    onClick={handleAIFallback}
                                    className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-black/40 backdrop-blur-md border border-white/20 text-white rounded-full text-[10px] font-bold uppercase tracking-wider hover:bg-black/60 transition-all"
                                >
                                    <Wand2 size={12} className="text-blue-300" />
                                    IA Scanner
                                </button>
                            )}
                            {error && (
                                <div className="absolute inset-0 bg-gray-900/90 flex flex-col items-center justify-center p-8 text-center">
                                    <AlertCircle size={32} className="text-red-400 mb-4" />
                                    <p className="text-sm text-white font-medium mb-6">{error}</p>
                                    <button onClick={startCamera} className="px-6 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold uppercase">Tentar De Novo</button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Always keep a hidden container for the scanner instance when not in camera mode */}
                    {mode !== 'camera' && (
                        <div id={cameraContainerId} className="hidden"></div>
                    )}

                    {mode === 'upload' && (
                        <div className="w-full min-h-[300px] flex flex-col">
                            <label className="flex-grow flex flex-col items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl bg-gray-50 dark:bg-gray-900/30 cursor-pointer overflow-hidden transition-all hover:bg-gray-100 dark:hover:bg-gray-800">
                                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                                {uploading ? (
                                    <Loader2 size={32} className="text-blue-500 animate-spin" />
                                ) : (
                                    <div className="text-center p-8">
                                        <Upload size={32} className="text-gray-400 mx-auto mb-4" />
                                        <h4 className="text-sm font-bold text-gray-900 dark:text-white">Subir Arquivo</h4>
                                        <p className="text-xs text-gray-500 mt-2">Verso do livro com ISBN.</p>
                                    </div>
                                )}
                            </label>
                            {error && <p className="mt-4 text-xs text-red-500 text-center font-medium">{error}</p>}
                        </div>
                    )}

                    {mode === 'manual' && (
                        <form onSubmit={(e) => { e.preventDefault(); (manualIsbn.trim() && onScanSuccess(manualIsbn)) }} className="space-y-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Código ISBN</label>
                                <input
                                    type="text"
                                    value={manualIsbn}
                                    onChange={(e) => setManualIsbn(e.target.value)}
                                    placeholder="Ex: 978..."
                                    className="w-full px-4 py-4 bg-gray-100 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder:text-gray-400 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-mono text-base"
                                    autoFocus
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={!manualIsbn.trim()}
                                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold uppercase tracking-widest text-xs shadow-md shadow-blue-600/20 disabled:opacity-50 transition-all"
                            >
                                Analisar Livro
                            </button>
                        </form>
                    )}
                </div>

                <style>{`
                    @keyframes scanLine {
                        0% { top: 0; }
                        50% { top: 100%; }
                        100% { top: 0; }
                    }
                    .animate-scan-line {
                        animation: scanLine 3s ease-in-out infinite;
                    }
                    #qr-reader video {
                        width: 100% !important;
                        height: 100% !important;
                        object-fit: cover !important;
                    }
                `}</style>
            </div>
        </div>
    );
};
