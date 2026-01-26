'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { 
    LayoutDashboard, Plus, List, Loader2, UploadCloud, 
    ArrowLeft, CheckCircle, Package, Trash2, Edit, X, Save 
} from 'lucide-react';

export default function AdminPage() {
    // --- State ---
    const [orders, setOrders] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]); // ✅ State เก็บรายการสินค้า
    const [isProcessing, setIsProcessing] = useState(false);

    // Form State
    const [prodId, setProdId] = useState<number | null>(null); // ✅ ถ้ามี ID แสดงว่ากำลังแก้ไข
    const [prodName, setProdName] = useState("");
    const [prodPrice, setProdPrice] = useState("");
    const [imageFile, setImageFile] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [oldImageUrl, setOldImageUrl] = useState<string | null>(null); // ✅ เก็บรูปเดิมกรณีไม่เปลี่ยนรูป

    // --- Fetch Data ---
    const fetchData = async () => {
        // ดึงออเดอร์
        const { data: orderData } = await supabase.from('orders').select('*').order('created_at', { ascending: false });
        setOrders(orderData || []);

        // ดึงสินค้า
        const { data: productData } = await supabase.from('products').select('*').order('id', { ascending: false });
        setProducts(productData || []);
    };

    useEffect(() => { fetchData(); }, []);

    // --- Image Handling ---
    const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    // --- CRUD Actions ---

    // 1. Save (Add or Update)
    const handleSaveProduct = async () => {
        if (!prodName || !prodPrice) {
            alert("Please fill name and price.");
            return;
        }
        setIsProcessing(true);

        try {
            let finalImageUrl = oldImageUrl;

            // ถ้ามีการเลือกรูปใหม่ ให้ Upload
            if (imageFile) {
                const fileExt = imageFile.name.split('.').pop();
                const fileName = `${Date.now()}.${fileExt}`;
                const { error: uploadError } = await supabase.storage
                    .from('product-images')
                    .upload(fileName, imageFile);

                if (uploadError) throw new Error("Upload Failed: " + uploadError.message);

                const { data: { publicUrl } } = supabase.storage
                    .from('product-images')
                    .getPublicUrl(fileName);
                
                finalImageUrl = publicUrl;
            }

            // เช็คว่า เพิ่มใหม่ หรือ แก้ไข
            if (prodId) {
                // --- UPDATE ---
                const { error } = await supabase.from('products')
                    .update({ 
                        name: prodName, 
                        price_thb: parseFloat(prodPrice), 
                        image_url: finalImageUrl 
                    })
                    .eq('id', prodId);
                
                if (error) throw error;
                alert("✅ Product Updated!");
            } else {
                // --- INSERT ---
                if (!finalImageUrl && !imageFile) throw new Error("Image is required for new product");
                
                const { error } = await supabase.from('products')
                    .insert([{ 
                        name: prodName, 
                        price_thb: parseFloat(prodPrice), 
                        image_url: finalImageUrl 
                    }]);

                if (error) throw error;
                alert("✅ Product Added!");
            }

            resetForm();
            fetchData();
            
        } catch (error: any) {
            alert("Error: " + error.message);
        } finally {
            setIsProcessing(false);
        }
    };

    // 2. Prepare Edit
    const handleEditClick = (product: any) => {
        setProdId(product.id);
        setProdName(product.name);
        setProdPrice(product.price_thb.toString());
        setOldImageUrl(product.image_url);
        setImagePreview(product.image_url); // โชว์รูปเดิม
        setImageFile(null); // เคลียร์ไฟล์ใหม่
        
        // Scroll ไปที่ฟอร์มข้างบน
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // 3. Delete
    const handleDeleteClick = async (id: number) => {
        if (!confirm("Are you sure you want to delete this product?")) return;
        
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) {
            alert("Failed to delete: " + error.message);
        } else {
            alert("🗑️ Product Deleted");
            fetchData();
        }
    };

    // Helper: Reset Form
    const resetForm = () => {
        setProdId(null);
        setProdName("");
        setProdPrice("");
        setImageFile(null);
        setImagePreview(null);
        setOldImageUrl(null);
    };

    return (
        <div className="min-h-screen bg-slate-100 font-sans text-slate-900 pb-20">
            {/* Header */}
            <header className="bg-slate-900 text-white p-6 shadow-md sticky top-0 z-10">
                <div className="max-w-6xl mx-auto flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <LayoutDashboard className="text-orange-500" />
                        <h1 className="text-xl font-bold">Admin Dashboard</h1>
                    </div>
                    <Link href="/mall" className="flex items-center gap-2 text-sm text-slate-300 hover:text-white transition-colors">
                        <ArrowLeft size={16}/> Back to Shop
                    </Link>
                </div>
            </header>

            <main className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* ---------------- FORM SECTION (Left) ---------------- */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border h-fit sticky top-24">
                    <div className="flex justify-between items-center mb-4 border-b pb-2">
                        <h2 className="text-lg font-bold flex items-center gap-2">
                            {prodId ? <Edit size={20} className="text-blue-600"/> : <Plus size={20} className="text-green-600"/>} 
                            {prodId ? "Edit Product" : "Add New Product"}
                        </h2>
                        {prodId && (
                            <button onClick={resetForm} className="text-xs text-red-500 flex items-center gap-1 hover:bg-red-50 p-1 rounded">
                                <X size={12}/> Cancel
                            </button>
                        )}
                    </div>

                    <div className="space-y-4">
                        {/* Image Upload */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-2">Product Image</label>
                            <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 hover:border-orange-400 transition-all overflow-hidden relative bg-white group">
                                {imagePreview ? (
                                    <>
                                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                                        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white font-bold text-xs">
                                            Change Image
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6 text-slate-400">
                                        <UploadCloud className="w-8 h-8 mb-2" />
                                        <p className="text-xs">Click to upload</p>
                                    </div>
                                )}
                                <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                            </label>
                        </div>
                        
                        {/* Input Fields */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Product Name</label>
                            <input type="text" value={prodName} onChange={e=>setProdName(e.target.value)} className="w-full p-3 border rounded-xl bg-slate-50 text-slate-900 outline-none focus:ring-2 focus:ring-blue-100 font-bold" placeholder="e.g. Gaming Mouse" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">Price (THB)</label>
                            <input type="number" value={prodPrice} onChange={e=>setProdPrice(e.target.value)} className="w-full p-3 border rounded-xl bg-slate-50 text-slate-900 outline-none focus:ring-2 focus:ring-blue-100 font-bold" placeholder="0.00" />
                        </div>
                        
                        <button 
                            onClick={handleSaveProduct} 
                            disabled={isProcessing} 
                            className={`w-full text-white py-3 rounded-xl font-bold hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 transition-all ${prodId ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}`}
                        >
                            {isProcessing ? <Loader2 className="animate-spin" size={18}/> : (prodId ? <><Save size={18}/> Update Product</> : <><Plus size={18}/> Add Product</>)}
                        </button>
                    </div>
                </div>

                {/* ---------------- LIST SECTION (Right) ---------------- */}
                <div className="lg:col-span-2 space-y-8">
                    
                    {/* 1. PRODUCT MANAGEMENT TABLE */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border">
                        <h2 className="text-lg font-bold mb-4 flex items-center gap-2 border-b pb-2">
                            <Package size={20}/> Manage Products ({products.length})
                        </h2>
                        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                            <table className="w-full text-sm text-left text-slate-700">
                                <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10">
                                    <tr>
                                        <th className="p-3">Image</th>
                                        <th className="p-3">Name</th>
                                        <th className="p-3">Price</th>
                                        <th className="p-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {products.length === 0 ? (
                                        <tr><td colSpan={4} className="p-8 text-center text-slate-400">No products found.</td></tr>
                                    ) : products.map((p) => (
                                        <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-3">
                                                <img src={p.image_url} className="w-10 h-10 rounded-lg object-cover bg-slate-100 border"/>
                                            </td>
                                            <td className="p-3 font-bold">{p.name}</td>
                                            <td className="p-3 text-slate-600">฿{p.price_thb.toLocaleString()}</td>
                                            <td className="p-3 text-right flex justify-end gap-2">
                                                <button onClick={() => handleEditClick(p)} className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100" title="Edit">
                                                    <Edit size={16}/>
                                                </button>
                                                <button onClick={() => handleDeleteClick(p.id)} className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100" title="Delete">
                                                    <Trash2 size={16}/>
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* 2. ORDER LIST TABLE */}
                    <div className="bg-white p-6 rounded-2xl shadow-sm border">
                        <div className="flex justify-between items-center mb-4 border-b pb-2">
                            <h2 className="text-lg font-bold flex items-center gap-2"><List size={20}/> Recent Orders</h2>
                            <button onClick={fetchData} className="text-xs text-blue-600 font-bold hover:underline">Refresh</button>
                        </div>
                        
                        <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                            <table className="w-full text-sm text-left text-slate-700">
                                <thead className="bg-slate-50 text-slate-500 sticky top-0 z-10">
                                    <tr>
                                        <th className="p-3">ID</th>
                                        <th className="p-3">Customer</th>
                                        <th className="p-3">Total</th>
                                        <th className="p-3">Payment</th>
                                        <th className="p-3">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {orders.length === 0 ? (
                                        <tr><td colSpan={5} className="p-10 text-center text-slate-400">No orders yet.</td></tr>
                                    ) : orders.map((order) => (
                                        <tr key={order.id} className="hover:bg-slate-50">
                                            <td className="p-3 font-mono text-xs text-slate-500">#{order.id}</td>
                                            <td className="p-3">
                                                <div className="font-bold text-xs truncate w-24 text-slate-800">{order.buyer_wallet}</div>
                                                <div className="text-[10px] text-slate-400">{new Date(order.created_at).toLocaleDateString()}</div>
                                            </td>
                                            <td className="p-3 font-bold text-slate-900">฿{order.final_price_thb.toLocaleString()}</td>
                                            <td className="p-3 text-xs text-slate-600">
                                                <span className="bg-slate-100 px-2 py-1 rounded">{order.crypto_amount} {order.payment_token}</span>
                                            </td>
                                            <td className="p-3"><span className="bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit"><CheckCircle size={10}/> {order.status}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
}