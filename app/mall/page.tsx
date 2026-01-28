'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useWriteContract, usePublicClient } from 'wagmi';
import { parseUnits, parseAbi } from 'viem';
import { supabase } from '@/lib/supabaseClient';
import { 
    ShoppingBag, Plus, CreditCard, X, CheckCircle, 
    Loader2, Crown, Settings, MapPin, Minus, Trash2
} from 'lucide-react';

// ==========================================
// CONFIGURATION
// ==========================================
const MERCHANT_WALLET = "0xA9b549c00E441A8043eDc267245ADF12533611b4";
const EXCHANGE_RATES: Record<string, number> = { "THB": 1, "USDT": 34.5, "ADS": 10.0, "ETH": 85000 };
const TOKENS: Record<string, { address: string; decimals: number }> = {
    "USDT": { address: "0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0", decimals: 6 },
    "ADS":  { address: "0xA3b1173bcba20Cf8E6200fDd4ba673DE9efE588C", decimals: 18 },
    "ETH":  { address: "NATIVE", decimals: 18 }
};
const ERC20_ABI = parseAbi(["function transfer(address to, uint256 amount) returns (bool)"]);

type Product = { id: number; name: string; price_thb: number; image_url: string; };
type UserProfile = { wallet_address: string; name: string; points: number; tier: string; phone: string; shipping_address: string; };
type CartItem = Product & { quantity: number };

export default function MallPage() {
    const { address, isConnected } = useAccount();
    const { writeContractAsync } = useWriteContract();
    const publicClient = usePublicClient();

    // State
    const [products, setProducts] = useState<Product[]>([]);
    const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    
    // Checkout State
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [checkoutStep, setCheckoutStep] = useState(1);
    const [shippingInfo, setShippingInfo] = useState({ name: '', address: '', phone: '' });
    const [selectedToken, setSelectedToken] = useState("USDT");
    const [isProcessing, setIsProcessing] = useState(false);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [statusMessage, setStatusMessage] = useState("");

    // Fetch Data
    const fetchProducts = async () => {
        setIsLoadingData(true);
        const { data, error } = await supabase.from('products').select('*').order('id', { ascending: false });
        if (!error) setProducts(data || []);
        setIsLoadingData(false);
    };

    const fetchUser = async () => {
        if (!address) return;
        const { data } = await supabase.from('users').select('*').eq('wallet_address', address).single();
        if (data) {
            setCurrentUser(data);
            setShippingInfo({ name: data.name || '', address: data.shipping_address || '', phone: data.phone || '' });
        } else {
            const newUser = { wallet_address: address, name: `User ${address.slice(0,6)}`, points: 0, tier: 'Silver' };
            await supabase.from('users').insert([newUser]);
            setCurrentUser(newUser as UserProfile);
        }
    };

    useEffect(() => { fetchProducts(); }, []);
    useEffect(() => { if (isConnected && address) fetchUser(); else setCurrentUser(null); }, [isConnected, address]);

    // Actions
    const addToCart = (product: Product) => setCart(prev => {
        const exist = prev.find(p => p.id === product.id);
        return exist ? prev.map(p => p.id === product.id ? { ...p, quantity: p.quantity + 1 } : p) : [...prev, { ...product, quantity: 1 }];
    });

    const removeFromCart = (productId: number) => {
        setCart(prev => prev.filter(p => p.id !== productId));
    };

    const updateQuantity = (productId: number, delta: number) => {
        setCart(prev => prev.map(p => {
            if (p.id === productId) {
                const newQty = p.quantity + delta;
                return newQty > 0 ? { ...p, quantity: newQty } : p;
            }
            return p;
        }));
    };

    // ✅ คำนวณราคา (เอาส่วนลดออก)
    const cartTotalTHB = cart.reduce((sum, item) => sum + (item.price_thb * item.quantity), 0);
    const discountTHB = 0; // ❌ ปิดระบบส่วนลด (ตั้งเป็น 0)
    const finalPriceTHB = cartTotalTHB - discountTHB;
    const cryptoPrice = (finalPriceTHB / EXCHANGE_RATES[selectedToken]).toFixed(6);

    const handleCheckout = async () => {
        if (!isConnected) { alert("Please Connect Wallet"); return; }
        if (!shippingInfo.name || !shippingInfo.address) { alert("Please fill shipping details"); setCheckoutStep(1); return; }
        
        setIsProcessing(true);
        setStatusMessage("Please confirm transaction in your wallet...");

        try {
            const tokenConfig = TOKENS[selectedToken];
            const amountWei = parseUnits(cryptoPrice, tokenConfig.decimals);
            
            let txHash = "";

            if (selectedToken !== "ETH") {
                txHash = await writeContractAsync({ 
                    address: tokenConfig.address as `0x${string}`, 
                    abi: ERC20_ABI, 
                    functionName: 'transfer', 
                    args: [MERCHANT_WALLET, amountWei] 
                });
            } else {
                alert("ETH payment implementation required sendTransaction hook");
                setIsProcessing(false);
                return;
            }

            if (txHash && publicClient) {
                setStatusMessage("Waiting for transaction confirmation... ⏳");
                await publicClient.waitForTransactionReceipt({ hash: txHash as `0x${string}` });
            }

            setStatusMessage("Saving order...");

            const earnedPoints = Math.floor(finalPriceTHB / 100);
            const newPoints = (currentUser?.points || 0) + earnedPoints;
            let newTier = newPoints > 5000 ? 'Platinum' : newPoints > 1000 ? 'Gold' : 'Silver';

            const { error } = await supabase.from('orders').insert([{
                buyer_wallet: address, items: cart, total_thb: cartTotalTHB, discount_thb: discountTHB, final_price_thb: finalPriceTHB,
                payment_token: selectedToken, crypto_amount: parseFloat(cryptoPrice), shipping_info: shippingInfo, status: 'PAID',
                tx_hash: txHash
            }]);
            
            if (error) throw error;
            
            if (address) { 
                await supabase.from('users').update({ 
                    points: newPoints, tier: newTier, phone: shippingInfo.phone, shipping_address: shippingInfo.address 
                }).eq('wallet_address', address); 
                fetchUser(); 
            }

            setCart([]); 
            setStatusMessage("");
            setCheckoutStep(3);

        } catch (error: any) { 
            console.error(error); 
            alert("Checkout Failed: " + error.message); 
        } finally { 
            setIsProcessing(false); 
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans pb-20 text-slate-900">
            <header className="bg-white border-b sticky top-0 z-10 px-6 py-4 flex justify-between items-center shadow-sm">
                <div className="flex items-center gap-2">
                    <ShoppingBag className="text-orange-600" />
                    <h1 className="text-xl font-bold text-slate-800">Shopping Mall</h1>
                </div>
                <div className="flex items-center gap-4">
                    <Link href="/mall/admin" className="hidden md:flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-orange-600 transition-colors border px-2 py-1 rounded-lg">
                        <Settings size={14}/> Admin System
                    </Link>

                    {currentUser && (
                        <div className="hidden md:flex flex-col items-end mr-4">
                            <div className="text-sm font-bold text-slate-800 flex items-center gap-1">
                                {currentUser.tier !== 'Silver' && <Crown size={14} className="text-yellow-500 fill-yellow-500"/>}
                                {currentUser.name}
                            </div>
                            <div className="text-xs text-slate-500">{currentUser.points} Points</div>
                        </div>
                    )}
                    
                    <ConnectButton showBalance={false} />
                    
                    <button onClick={()=>{setIsCheckoutOpen(true); setCheckoutStep(1);}} className="relative p-2 bg-slate-900 text-white rounded-full hover:bg-slate-700 transition-all">
                        <ShoppingBag size={20} />
                        {cart.length > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full font-bold">{cart.length}</span>}
                    </button>
                </div>
            </header>

            <main className="max-w-6xl mx-auto p-6">
                <div className="animate-in fade-in">
                    {isLoadingData ? <div className="text-center py-20 text-slate-500"><Loader2 className="animate-spin mx-auto"/> Loading Products...</div> : (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            {products.map((item) => (
                                <div key={item.id} className="bg-white rounded-2xl p-4 shadow-sm border hover:shadow-lg transition-all group">
                                    <div className="h-40 bg-slate-100 rounded-xl mb-4 overflow-hidden relative">
                                        <img src={item.image_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                    </div>
                                    <h3 className="font-bold text-slate-800 truncate">{item.name}</h3>
                                    <div className="flex justify-between items-end mt-2 mb-4">
                                        <div className="text-orange-600 font-extrabold text-lg">฿{item.price_thb.toLocaleString()}</div>
                                        <div className="text-xs text-slate-400">≈ {(item.price_thb/EXCHANGE_RATES['USDT']).toFixed(2)} USDT</div>
                                    </div>
                                    <button onClick={()=>addToCart(item)} className="w-full bg-slate-900 text-white py-2 rounded-xl font-bold hover:bg-slate-800 flex items-center justify-center gap-2 text-sm">
                                        <Plus size={16}/> Add to Cart
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {isCheckoutOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm text-slate-900">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl flex flex-col max-h-[90vh]">
                        <div className="bg-slate-50 p-4 border-b flex justify-between items-center">
                            <h2 className="font-bold text-lg text-slate-800">Checkout Step {checkoutStep}/3</h2>
                            <button onClick={()=>setIsCheckoutOpen(false)} className="text-slate-500 hover:text-slate-800"><X size={20}/></button>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1">
                            {checkoutStep === 1 && (
                                <div className="space-y-6">
                                    <div>
                                        <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><ShoppingBag size={18}/> Order Summary</h3>
                                        <div className="bg-slate-50 rounded-xl border p-2 space-y-2 max-h-48 overflow-y-auto">
                                            {cart.length === 0 ? <p className="text-center text-slate-400 text-sm py-4">Your cart is empty.</p> : cart.map((item) => (
                                                <div key={item.id} className="flex items-center justify-between p-3 bg-white rounded-lg border shadow-sm">
                                                    <div className="flex items-center gap-3">
                                                        <img src={item.image_url} className="w-12 h-12 rounded-md object-cover bg-slate-100 border"/>
                                                        <div>
                                                            <div className="text-xs font-bold text-slate-800 truncate w-24 sm:w-32">{item.name}</div>
                                                            <div className="text-[10px] text-slate-500 mb-1">฿{item.price_thb.toLocaleString()} / unit</div>
                                                            <div className="flex items-center gap-1">
                                                                <button onClick={()=>updateQuantity(item.id, -1)} className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 text-slate-600 border"><Minus size={12}/></button>
                                                                <span className="text-xs font-bold w-6 text-center">{item.quantity}</span>
                                                                <button onClick={()=>updateQuantity(item.id, 1)} className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 text-slate-600 border"><Plus size={12}/></button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-2">
                                                        <div className="font-bold text-sm text-slate-900">฿{(item.price_thb * item.quantity).toLocaleString()}</div>
                                                        <button onClick={()=>removeFromCart(item.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-1 rounded transition-colors"><Trash2 size={16}/></button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        {cart.length > 0 && (
                                            <div className="flex justify-between items-center mt-2 px-2">
                                                <span className="text-xs font-bold text-slate-500">Total Amount</span>
                                                <span className="text-sm font-extrabold text-slate-800">฿{cartTotalTHB.toLocaleString()}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="border-t pt-4">
                                        <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2"><MapPin size={18}/> Shipping Details</h3>
                                        <div className="space-y-3">
                                            <div><label className="text-xs font-bold text-slate-500 ml-1">Receiver Name</label><input type="text" value={shippingInfo.name} onChange={e=>setShippingInfo({...shippingInfo, name: e.target.value})} className="w-full border rounded-xl p-3 bg-white text-slate-900 placeholder:text-slate-400 text-sm font-bold" placeholder="Full Name"/></div>
                                            <div><label className="text-xs font-bold text-slate-500 ml-1">Phone Number</label><input type="tel" value={shippingInfo.phone} onChange={e=>setShippingInfo({...shippingInfo, phone: e.target.value})} className="w-full border rounded-xl p-3 bg-white text-slate-900 placeholder:text-slate-400 text-sm font-bold" placeholder="08x-xxx-xxxx"/></div>
                                            <div><label className="text-xs font-bold text-slate-500 ml-1">Address</label><textarea value={shippingInfo.address} onChange={e=>setShippingInfo({...shippingInfo, address: e.target.value})} className="w-full border rounded-xl p-3 bg-white text-slate-900 placeholder:text-slate-400 text-sm" rows={3} placeholder="House No, Street, City, Zip Code..."></textarea></div>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {checkoutStep === 2 && (
                                <div className="space-y-4">
                                    <div className="flex justify-between font-bold text-lg">
                                        <span className="text-slate-600">Total Amount</span>
                                        <span className="text-orange-600">฿{finalPriceTHB.toLocaleString()}</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        {Object.keys(TOKENS).map(token => (
                                            <button key={token} onClick={()=>setSelectedToken(token)} className={`py-3 rounded-xl border font-bold text-sm ${selectedToken===token ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}>{token}</button>
                                        ))}
                                    </div>
                                    <div className="bg-orange-50 p-4 rounded-xl text-center">
                                        <div className="text-sm text-orange-800">You Pay</div>
                                        <div className="text-2xl font-extrabold text-slate-900">{cryptoPrice} {selectedToken}</div>
                                    </div>
                                </div>
                            )}
                            {checkoutStep === 3 && (
                                <div className="text-center py-10">
                                    <CheckCircle size={64} className="text-green-500 mx-auto mb-4"/>
                                    <h3 className="text-2xl font-bold text-slate-800">Success!</h3>
                                    <p className="text-slate-500">Transaction Confirmed & Order Saved.</p>
                                </div>
                            )}
                        </div>
                        <div className="p-4 border-t bg-slate-50 flex gap-3">
                            {checkoutStep === 1 && <button onClick={()=>setCheckoutStep(2)} disabled={cart.length === 0} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors">Next</button>}
                            
                            {checkoutStep === 2 && (
                                <button onClick={handleCheckout} disabled={isProcessing} className="w-full bg-orange-600 text-white py-3 rounded-xl font-bold disabled:opacity-70 flex justify-center items-center gap-2">
                                    {isProcessing ? <><Loader2 className="animate-spin" size={18}/> {statusMessage || "Processing..."}</> : "Pay Now"}
                                </button>
                            )}
                            
                            {checkoutStep === 3 && <button onClick={()=>{setIsCheckoutOpen(false); setCheckoutStep(1);}} className="w-full bg-slate-900 text-white py-3 rounded-xl font-bold">Close</button>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}