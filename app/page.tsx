"use client";

import "./globals.css";
import { Outfit } from "next/font/google";
import {useState} from "react";
import FallingText from "@/components/FallingText";

const outfit = Outfit({
  variable: "--font-sans",
});

export default function Home() {
  const [adventureStarted, setAdventureStarted] = useState(false);

  return (
    <main className={`${outfit.variable} h-screen flex items-center justify-center`}>
      <FallingText
        text="Welcome to my portfolio !"
        highlightWords={["!"]}
        fontSize="4rem"
        trigger={adventureStarted}
        gravity={0.98}
        wireframes={false}
        backgroundColor="transparent"
        mouseConstraintStiffness={0.2}
        launchPower={2}
      />
      <h1>hi</h1>
      <button onClick={() => setAdventureStarted(true)}>
       Click me!
      </button>
    </main>
  );
}
