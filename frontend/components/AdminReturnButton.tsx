"use client";

import React, { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import Link from 'next/link';

export default function AdminReturnButton() {
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        // Check if admin_auth exists in localStorage
        const auth = localStorage.getItem("admin_auth");
        if (auth === "true") {
            setIsAdmin(true);
        }
    }, []);

    if (!isAdmin) return null;

    return (
        <Link
            href="/admin"
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-lg text-xs font-bold transition-all border border-red-500/20 mr-2"
        >
            <Lock size={12} />
            ADMIN
        </Link>
    );
}
