'use client';

import React, { useState } from 'react';
import { usePublicClient } from 'wagmi';
import { Search, CheckCircle, XCircle, Loader2, AlertCircle, Clock } from 'lucide-react';

export default function TestTxPage() {
    const publicClient = usePublicClient();
    const [txHash, setTxHash] = useState("");
    const [status, setStatus] = useState<'IDLE' | 'LOADING' | 'SUCCESS' | 'FAILED' | 'PENDING' | 'NOT_FOUND'>('IDLE');
    const [txData, setTxData] = useState<any>(null);
    const [errorMsg, setErrorMsg] = useState("");

    const checkTransaction = async () => {
        if (!txHash) {
            alert("Please enter Transaction Hash");
            return;
        }
        if (!publicClient) {
            alert("Wallet provider not initialized");
            return;
        }

        setStatus('LOADING');
        setTxData(null);
        setErrorMsg("");

        try {
            // 1. ลองดึง Receipt (ใบเสร็จยืนยันผล)
            try {
                const receipt = await publicClient.getTransactionReceipt({ 
                    hash: txHash as `0x${string}` 
                });

                if (receipt) {
                    setTxData(receipt);
                    if (receipt.status === 'success') {
                        setStatus('SUCCESS'); // ✅ ทำธุรกรรมเสร็จสิ้น
                    } else {
                        setStatus('FAILED');  // ❌ ทำธุรกรรมล้มเหลว (Reverted)
                    }
                    return;
                }
            } catch (err) {
                // ถ้าหา Receipt ไม่เจอ (มักจะ error ว่า TransactionReceiptNotFoundError) ให้ไปเช็ค Mempool ต่อ
                console.log("Receipt not found, checking mempool...");
            }

            // 2. ถ้าไม่มี Receipt ลองดึง Transaction (ดูว่ามีใน Mempool หรือยัง)
            try {
                const transaction = await publicClient.getTransaction({ 
                    hash: txHash as `0x${string}` 
                });

                if (transaction) {
                    setTxData(transaction);
                    setStatus('PENDING'); // ⏳ มีในระบบ (รอ confirm)
                    return;
                }
            } catch (err) {
                console.log("Transaction not found in mempool");
            }

            // 3. ถ้าไม่เจอทั้งคู่
            setStatus('NOT_FOUND'); // 🚫 ไม่พบในระบบ

        } catch (error: any) {
            console.error(error);
            setErrorMsg(error.message || "Unknown error occurred");
            setStatus('NOT_FOUND');
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans p-6 flex flex-col items-center">
            <div className="max-w-2xl w-full bg-white rounded-3xl shadow-xl p-8 border border-slate-100">
                <h1 className="text-2xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                    <Search className="text-blue-600" /> Transaction Checker
                </h1>

                {/* Input Area */}
                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-bold text-slate-600 ml-1">Transaction Hash</label>
                        <input 
                            type="text" 
                            value={txHash}
                            onChange={(e) => setTxHash(e.target.value.trim())}
                            placeholder="0x..." 
                            className="w-full p-4 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:outline-none font-mono text-slate-700 bg-slate-50"
                        />
                    </div>
                    <button 
                        onClick={checkTransaction} 
                        disabled={status === 'LOADING'}
                        className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 transition-all flex justify-center items-center gap-2 shadow-lg shadow-blue-200"
                    >
                        {status === 'LOADING' ? <><Loader2 className="animate-spin"/> Checking...</> : "Check Status"}
                    </button>
                </div>

                {/* Result Area */}
                {status !== 'IDLE' && (
                    <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        
                        {/* 1. SUCCESS */}
                        {status === 'SUCCESS' && (
                            <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
                                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <CheckCircle size={32} />
                                </div>
                                <h3 className="text-xl font-bold text-green-700">Transaction Successful</h3>
                                <p className="text-green-600">ทำธุรกรรมเสร็จสิ้นสมบูรณ์</p>
                                <div className="mt-4 text-xs font-mono text-slate-500 bg-white p-2 rounded border break-all">
                                    Block Number: {txData?.blockNumber?.toString()} <br/>
                                    Gas Used: {txData?.gasUsed?.toString()}
                                </div>
                            </div>
                        )}

                        {/* 2. FAILED */}
                        {status === 'FAILED' && (
                            <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center">
                                <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <XCircle size={32} />
                                </div>
                                <h3 className="text-xl font-bold text-red-700">Transaction Failed</h3>
                                <p className="text-red-600">ทำธุรกรรมล้มเหลว (Reverted)</p>
                                <p className="text-xs text-red-400 mt-2">อาจเกิดจาก Gas ไม่พอ หรือเงื่อนไข Smart Contract ไม่ผ่าน</p>
                            </div>
                        )}

                        {/* 3. PENDING */}
                        {status === 'PENDING' && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 text-center">
                                <div className="w-16 h-16 bg-yellow-100 text-yellow-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Clock size={32} className="animate-pulse"/>
                                </div>
                                <h3 className="text-xl font-bold text-yellow-700">Transaction Pending</h3>
                                <p className="text-yellow-600">พบในระบบแล้ว กำลังรอการยืนยัน...</p>
                                <p className="text-xs text-yellow-500 mt-2">กรุณารอสักครู่แล้วตรวจสอบใหม่อีกครั้ง</p>
                            </div>
                        )}

                        {/* 4. NOT FOUND */}
                        {status === 'NOT_FOUND' && (
                            <div className="bg-slate-100 border border-slate-200 rounded-2xl p-6 text-center">
                                <div className="w-16 h-16 bg-slate-200 text-slate-500 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <AlertCircle size={32} />
                                </div>
                                <h3 className="text-xl font-bold text-slate-700">Not Found</h3>
                                <p className="text-slate-500">ไม่พบข้อมูลธุรกรรมในระบบ</p>
                                <p className="text-xs text-slate-400 mt-2">โปรดตรวจสอบว่า Hash ถูกต้อง หรือเลือก Network ถูกต้องหรือไม่</p>
                                {errorMsg && <div className="mt-4 text-[10px] text-red-400 font-mono bg-red-50 p-2 rounded text-left overflow-auto max-h-20">{errorMsg}</div>}
                            </div>
                        )}

                    </div>
                )}
            </div>
        </div>
    );
}