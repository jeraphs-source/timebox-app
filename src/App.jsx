import { useEffect, useRef, useState } from "react";
import { create } from "zustand";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
} from "firebase/auth";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  enableIndexedDbPersistence,
} from "firebase/firestore";

// 🔥 Firebase 설정 (나중에 수정)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

enableIndexedDbPersistence(db).catch(() => {});

// Zustand Store
const useStore = create((set) => ({
  user: null,
  priorities: Array(7).fill(""),
  checked: Array(7).fill(false),
  plans: Array(27).fill(""),
  dos: Array(27).fill(""),
  completed: Array(27).fill(false),
  setUser: (u) => set({ user: u }),
  setAll: (d) =>
    set({
      priorities: d.priorities || Array(7).fill(""),
      checked: d.checked || Array(7).fill(false),
      plans: d.plans || Array(27).fill(""),
      dos: d.dos || Array(27).fill(""),
      completed: d.completed || Array(27).fill(false),
    }),
  setState: (fn) => set(fn),
}));

export default function App() {
  const store = useStore();
  const { user, setUser } = store;
  const today = new Date().toISOString().split("T")[0];

  const history = useRef([]);
  const saveRef = useRef(null);

  // 로그인 상태
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  const login = () => signInWithPopup(auth, provider);
  const logout = () => signOut(auth);

  // 데이터 로드
  useEffect(() => {
    if (!user) return;
    getDoc(doc(db, "users", user.uid, "daily", today)).then((snap) => {
      if (snap.exists()) store.setAll(snap.data());
    });
  }, [user]);

  // 자동 저장
  useEffect(() => {
    if (!user) return;
    clearTimeout(saveRef.current);
    saveRef.current = setTimeout(() => {
      const s = useStore.getState();
      setDoc(doc(db, "users", user.uid, "daily", today), {
        priorities: s.priorities,
        checked: s.checked,
        plans: s.plans,
        dos: s.dos,
        completed: s.completed,
        updatedAt: serverTimestamp(),
      });
    }, 2000);
  }, [store.priorities, store.checked, store.plans, store.dos, store.completed]);

  // Undo
  const saveHistory = () => {
    history.current.push(JSON.stringify(useStore.getState()));
    if (history.current.length > 50) history.current.shift();
  };

  const undo = () => {
    if (!history.current.length) return;
    const prev = JSON.parse(history.current.pop());
    store.setAll(prev);
  };

  useEffect(() => {
    const key = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        undo();
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);

  // UI
  if (!user)
    return (
      <div className="h-screen flex items-center justify-center">
        <button onClick={login} className="bg-blue-600 text-white px-6 py-3">
          Google 로그인
        </button>
      </div>
    );

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex justify-between mb-4">
        <h1 className="text-xl font-bold">TimeBox</h1>
        <div className="flex gap-2">
          <button onClick={undo}>Undo</button>
          <button onClick={logout}>Logout</button>
        </div>
      </div>

      {store.priorities.map((p, i) => (
        <div key={i} className="flex gap-2 mb-2">
          <input
            type="checkbox"
            checked={store.checked[i]}
            onChange={() => {
              saveHistory();
              store.setState((s) => {
                const c = [...s.checked];
                c[i] = !c[i];
                return { checked: c };
              });
            }}
          />
          <input
            value={p}
            onChange={(e) => {
              store.setState((s) => {
                const arr = [...s.priorities];
                arr[i] = e.target.value;
                return { priorities: arr };
              });
            }}
            className="border flex-1 p-1"
          />
        </div>
      ))}

      {store.plans.map((p, i) => (
        <div key={i} className="flex gap-2 mb-1">
          <input
            value={p}
            onChange={(e) => {
              store.setState((s) => {
                const arr = [...s.plans];
                arr[i] = e.target.value;
                return { plans: arr };
              });
            }}
            className="border p-1 w-1/2"
          />
          <input
            value={store.dos[i]}
            onChange={(e) => {
              store.setState((s) => {
                const arr = [...s.dos];
                arr[i] = e.target.value;
                return { dos: arr };
              });
            }}
            className="border p-1 w-1/2"
          />
        </div>
      ))}
    </div>
  );
}
