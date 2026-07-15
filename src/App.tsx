/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, FormEvent, useRef, ChangeEvent } from "react";
import { 
  Flame, 
  Plus, 
  Trash2, 
  Scale, 
  Sliders, 
  TrendingDown, 
  Calendar,
  Utensils,
  ChevronRight,
  Info,
  Camera,
  Upload,
  Loader2,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Check,
  HelpCircle
} from "lucide-react";

interface FoodItem {
  id: string;
  name: string;
  calories: number;
}

export default function App() {
  // Real state for Section 1 & 2
  const [totalCalories, setTotalCalories] = useState<number>(0);
  const [foodName, setFoodName] = useState<string>("");
  const [calorieInput, setCalorieInput] = useState<string>("");
  const [foodLog, setFoodLog] = useState<FoodItem[]>([]);

  // Real state for Section 3
  const [currentWeight, setCurrentWeight] = useState<string>("80");
  const [heightCm, setHeightCm] = useState<string>("170");
  const [goalPace, setGoalPace] = useState<"standard" | "moderate" | "aggressive">("standard");
  const [deficit, setDeficit] = useState<number>(500);
  const [targetFatLoss, setTargetFatLoss] = useState<number>(5); // Default to losing 5kg of body fat

  // AI Food Camera state
  const [activeTab, setActiveTab] = useState<"manual" | "ai">("manual");
  const [showWebcam, setShowWebcam] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState<{ foodName: string; calories: number } | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Suggested daily target calculation based on weight and goal pace selection
  const weightNum = parseFloat(currentWeight);
  const suggestedCalorieTarget = !isNaN(weightNum) && weightNum > 0
    ? Math.max(1200, Math.round(weightNum * 30 - (goalPace === "moderate" ? 300 : goalPace === "aggressive" ? 750 : 500)))
    : 0;

  const estimatedWeeks = deficit > 0 && targetFatLoss > 0
    ? parseFloat(((targetFatLoss * 7700) / (deficit * 7)).toFixed(1))
    : 0;

  // BMI calculation & safety info
  const heightNum = parseFloat(heightCm);
  const bmi = !isNaN(weightNum) && !isNaN(heightNum) && heightNum > 0
    ? parseFloat((weightNum / Math.pow(heightNum / 100, 2)).toFixed(1))
    : 0;

  let bmiCategory = "";
  let bmiColor = "";
  let bmiSafetyInfo = "";

  if (bmi > 0) {
    if (bmi < 18.5) {
      bmiCategory = "Underweight";
      bmiColor = "text-amber-600 bg-amber-50/50 border-amber-200/60";
      bmiSafetyInfo = "Below healthy range. Standard pace recommended.";
    } else if (bmi <= 24.9) {
      bmiCategory = "Normal Weight";
      bmiColor = "text-emerald-700 bg-emerald-50/50 border-emerald-200/60";
      bmiSafetyInfo = "Healthy range! Safe weight level. Maintain balance.";
    } else if (bmi <= 29.9) {
      bmiCategory = "Overweight";
      bmiColor = "text-amber-700 bg-amber-50/50 border-amber-200/60";
      bmiSafetyInfo = "Overweight range. Moderate pace recommended.";
    } else {
      bmiCategory = "Obese";
      bmiColor = "text-rose-700 bg-rose-50/50 border-rose-200/60";
      bmiSafetyInfo = "Obese range. Consultation & steady pace recommended.";
    }
  }

  const startWebcam = async () => {
    try {
      setApiError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false
      });
      setCameraStream(stream);
      setShowWebcam(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err: any) {
      console.error("Camera access failed", err);
      setApiError("Camera permission denied or not found. Please upload a photo instead.");
    }
  };

  const stopWebcam = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setShowWebcam(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg");
      setImagePreview(dataUrl);
      stopWebcam();
      estimateCalories(dataUrl);
    }
  };

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      setImagePreview(dataUrl);
      estimateCalories(dataUrl);
    };
    reader.readAsDataURL(file);
  };

  const estimateCalories = async (base64Data: string) => {
    setIsAnalyzing(true);
    setApiError(null);
    setAiResult(null);
    try {
      const response = await fetch("/api/estimate-calories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64Data,
          mimeType: "image/jpeg"
        })
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Estimation failed");
      }
      const data = await response.json();
      setAiResult(data);
    } catch (err: any) {
      console.error(err);
      setApiError(err.message || "Failed to analyze image. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAddAiFood = () => {
    if (!aiResult) return;
    const newItem: FoodItem = {
      id: Date.now().toString(),
      name: aiResult.foodName,
      calories: aiResult.calories
    };
    setFoodLog(prev => [newItem, ...prev]);
    setTotalCalories(prev => prev + aiResult.calories);
    // Reset AI scanner view
    setImagePreview(null);
    setAiResult(null);
  };

  // Event handlers for Section 1 & 2
  const handleAddFood = (e: FormEvent) => {
    e.preventDefault();
    if (!foodName.trim() || !calorieInput.trim()) return;
    
    const calories = parseInt(calorieInput, 10);
    if (isNaN(calories) || calories < 0) return;

    const newItem: FoodItem = {
      id: Date.now().toString(),
      name: foodName.trim(),
      calories: calories
    };

    setFoodLog(prev => [newItem, ...prev]);
    setTotalCalories(prev => prev + calories);
    setFoodName("");
    setCalorieInput("");
  };

  const handleReset = () => {
    setFoodLog([]);
    setTotalCalories(0);
    setImagePreview(null);
    setAiResult(null);
    stopWebcam();
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
      {/* Header Section */}
      <header className="bg-white border-b border-slate-200 px-8 py-6 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h1 id="app-title" className="text-2xl font-bold tracking-tight text-slate-900">
            Calorie & Fat Loss Tracker
          </h1>
          <p className="text-slate-500 text-sm">Simple weight management for beginners</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Session Active</span>
          <div className="h-2 w-2 rounded-full bg-emerald-500"></div>
        </div>
      </header>

      {/* Main Viewport Content */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 p-8">
        
        {/* Left Section: Dashboard & Counter */}
        <section id="calorie-dashboard-section" className="lg:col-span-3 flex flex-col gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm flex-1 flex flex-col justify-center items-center text-center">
            <h2 className="text-slate-500 font-medium uppercase text-xs tracking-widest mb-4">
              Today's Consumption
            </h2>
            <div id="calorie-total-display" className="text-7xl font-light text-slate-900 tabular-nums">
              {totalCalories}
            </div>
            <p className="text-slate-400 mt-2">Total Calories</p>
            <button 
              id="reset-counter-button" 
              onClick={handleReset}
              className="mt-12 text-sm font-semibold text-slate-400 hover:text-rose-500 transition-colors uppercase tracking-widest cursor-pointer"
            >
              Reset Counter
            </button>
          </div>

          <div className="bg-indigo-600 rounded-2xl p-6 text-white">
            <h3 className="text-indigo-100 text-xs font-bold uppercase tracking-widest mb-3">
              Daily Target
            </h3>
            <div id="suggested-calorie-target" className="text-3xl font-semibold mb-1">
              {suggestedCalorieTarget.toLocaleString()}
            </div>
            <p className="text-indigo-200 text-xs">kcal suggested daily limit</p>
          </div>
        </section>

        {/* Center Section: Food Entry Log */}
        <section id="food-entry-log-section" className="lg:col-span-5 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Tabs header */}
          <div className="flex border-b border-slate-200">
            <button 
              type="button"
              onClick={() => { setActiveTab("manual"); stopWebcam(); }}
              className={`flex-1 py-4 text-center text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                activeTab === "manual" 
                  ? "border-slate-950 text-slate-950" 
                  : "border-transparent text-slate-400 hover:text-slate-600"
              }`}
            >
              ✍️ Manual Entry
            </button>
            <button 
              type="button"
              onClick={() => { setActiveTab("ai"); }}
              className={`flex-1 py-4 text-center text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                activeTab === "ai" 
                  ? "border-indigo-600 text-indigo-600" 
                  : "border-transparent text-slate-400 hover:text-indigo-600"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              📸 AI Photo Scan
            </button>
          </div>

          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            {activeTab === "manual" ? (
              <div>
                <h2 className="text-sm font-bold text-slate-700 mb-3 uppercase tracking-wider">Log Meal Manually</h2>
                <form onSubmit={handleAddFood} className="flex flex-col sm:flex-row gap-2">
                  <input 
                    id="food-name-input"
                    type="text" 
                    placeholder="e.g. Avocado Toast" 
                    value={foodName}
                    onChange={(e) => setFoodName(e.target.value)}
                    className="flex-1 bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                  <input 
                    id="calorie-amount-input"
                    type="number" 
                    placeholder="Cals" 
                    value={calorieInput}
                    onChange={(e) => setCalorieInput(e.target.value)}
                    className="w-24 bg-white border border-slate-200 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-mono"
                  />
                  <button 
                    id="add-food-button"
                    type="submit"
                    className="bg-slate-900 text-white px-6 py-2 rounded-lg text-sm font-semibold hover:bg-slate-800 transition-all cursor-pointer whitespace-nowrap"
                  >
                    Add
                  </button>
                </form>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-500" />
                    AI Calorie Estimator
                  </h2>
                  <button 
                    type="button" 
                    onClick={() => {
                      setImagePreview(null);
                      setAiResult(null);
                      setApiError(null);
                      stopWebcam();
                    }}
                    className="text-[11px] font-semibold text-slate-400 hover:text-rose-500 transition-colors uppercase tracking-wider"
                  >
                    Reset Cam
                  </button>
                </div>

                {/* Webcam Live Capture View */}
                {showWebcam && (
                  <div className="relative rounded-xl overflow-hidden bg-black aspect-video border border-slate-200">
                    <video 
                      ref={videoRef} 
                      autoPlay 
                      playsInline 
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3 px-4">
                      <button
                        type="button"
                        onClick={capturePhoto}
                        className="bg-white hover:bg-slate-100 text-slate-900 px-5 py-2 rounded-full text-xs font-bold shadow-lg flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Camera className="w-4 h-4 text-rose-500" />
                        Capture & Analyze
                      </button>
                      <button
                        type="button"
                        onClick={stopWebcam}
                        className="bg-slate-900/80 hover:bg-slate-900 text-white px-4 py-2 rounded-full text-xs font-semibold backdrop-blur-xs transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Photo Upload & Select Launcher */}
                {!showWebcam && !imagePreview && (
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={startWebcam}
                      className="flex flex-col items-center justify-center p-6 bg-white border border-dashed border-slate-200 hover:border-indigo-500 rounded-xl transition-all hover:bg-indigo-50/20 cursor-pointer group"
                    >
                      <Camera className="w-6 h-6 text-slate-400 group-hover:text-indigo-500 mb-2 transition-colors" />
                      <span className="text-xs font-bold text-slate-600 group-hover:text-indigo-700">Use Live Camera</span>
                      <span className="text-[10px] text-slate-400 mt-1">Take a food picture</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex flex-col items-center justify-center p-6 bg-white border border-dashed border-slate-200 hover:border-indigo-500 rounded-xl transition-all hover:bg-indigo-50/20 cursor-pointer group"
                    >
                      <Upload className="w-6 h-6 text-slate-400 group-hover:text-indigo-500 mb-2 transition-colors" />
                      <span className="text-xs font-bold text-slate-600 group-hover:text-indigo-700">Upload Photo</span>
                      <span className="text-[10px] text-slate-400 mt-1">From your gallery</span>
                    </button>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </div>
                )}

                {/* Processing and Analysis View */}
                {imagePreview && (
                  <div className="space-y-4">
                    <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 max-h-52 flex items-center justify-center">
                      <img 
                        src={imagePreview} 
                        alt="Food preview" 
                        className="w-full h-full object-cover max-h-52"
                        referrerPolicy="no-referrer"
                      />
                      {isAnalyzing && (
                        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex flex-col items-center justify-center text-white p-4">
                          <Loader2 className="w-8 h-8 animate-spin text-indigo-400 mb-2" />
                          <span className="text-xs font-bold uppercase tracking-widest text-indigo-200">Analyzing Photo...</span>
                          <span className="text-[10px] text-slate-300 mt-1 animate-pulse">Gemini is estimating calories...</span>
                        </div>
                      )}
                    </div>

                    {/* AI Estimation Result Card */}
                    {aiResult && (
                      <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 animate-fadeIn">
                        <div className="text-center sm:text-left">
                          <span className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest block mb-0.5">Identified Food Item</span>
                          <h4 className="text-sm font-extrabold text-slate-800 leading-tight">{aiResult.foodName}</h4>
                          <span className="text-[10px] text-slate-400 block mt-1">Calorie estimate based on average portion</span>
                        </div>
                        <div className="text-center sm:text-right shrink-0">
                          <div className="text-2xl font-bold text-indigo-900 font-mono">+{aiResult.calories} <span className="text-xs">kcal</span></div>
                          <div className="flex gap-1.5 mt-2 justify-center sm:justify-end">
                            <button
                              type="button"
                              onClick={handleAddAiFood}
                              className="bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-md shadow-xs flex items-center gap-1 transition-all cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" /> Log
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setImagePreview(null);
                                setAiResult(null);
                                setApiError(null);
                              }}
                              className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-600 text-[11px] font-bold px-3 py-1.5 rounded-md transition-all cursor-pointer"
                            >
                              Reset
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* API error state */}
                    {apiError && (
                      <div className="bg-rose-50 border border-rose-100 text-rose-700 rounded-xl p-4 text-xs flex items-start gap-2.5">
                        <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">AI Scan Failed</p>
                          <p className="text-rose-600 mt-0.5">{apiError}</p>
                          <button
                            type="button"
                            onClick={() => {
                              setImagePreview(null);
                              setAiResult(null);
                              setApiError(null);
                            }}
                            className="mt-2 text-[10px] font-bold uppercase tracking-wider text-rose-700 underline hover:text-rose-800"
                          >
                            Try Another Image
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 min-h-[300px]">
            {foodLog.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-300 text-sm italic py-12">
                No meals logged yet today
              </div>
            ) : (
              <div className="space-y-2">
                {foodLog.map((item) => (
                  <div key={item.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <span className="font-medium text-slate-800">{item.name}</span>
                    </div>
                    <div className="font-mono font-bold text-slate-600">
                      +{item.calories}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Right Section: Fat Loss Estimator */}
        <section id="fat-loss-estimator-section" className="lg:col-span-4 flex flex-col gap-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm flex-1">
            <h2 className="text-lg font-bold mb-6">Fat Loss Estimator</h2>
            
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="current-weight-input" className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                    Weight (kg)
                  </label>
                  <input 
                    id="current-weight-input"
                    type="number" 
                    value={currentWeight}
                    onChange={(e) => setCurrentWeight(e.target.value)}
                    className="w-full text-3xl font-light border-b border-slate-200 focus:border-indigo-500 outline-none pb-2 transition-all font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="height-cm-input" className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                    Height (cm)
                  </label>
                  <input 
                    id="height-cm-input"
                    type="number" 
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    className="w-full text-3xl font-light border-b border-slate-200 focus:border-indigo-500 outline-none pb-2 transition-all font-mono"
                  />
                </div>
              </div>

              {bmi > 0 && (
                <div className={`rounded-xl border p-4 transition-all duration-300 ${bmiColor}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-80 block mb-0.5">Your Body Mass Index</span>
                      <span className="text-sm font-bold">{bmiCategory}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-80 block mb-0.5">BMI Value</span>
                      <span className="text-2xl font-extrabold font-mono leading-none">{bmi}</span>
                    </div>
                  </div>
                  <div className="mt-2.5 pt-2 border-t border-slate-200/40 text-[11px] leading-relaxed opacity-90 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 shrink-0" />
                    <span>{bmiSafetyInfo}</span>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                  Goal Weight Loss Pace
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(["standard", "moderate", "aggressive"] as const).map((pace) => (
                    <button
                      key={pace}
                      type="button"
                      onClick={() => setGoalPace(pace)}
                      className={`py-2 px-3 text-xs font-bold tracking-wider uppercase rounded-lg border transition-all cursor-pointer ${
                        goalPace === pace
                          ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                          : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                      }`}
                    >
                      {pace}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-3">
                  <label htmlFor="deficit-slider" className="block text-xs font-bold text-slate-500 uppercase tracking-widest">
                    Daily Deficit
                  </label>
                  <span className="text-sm font-semibold text-indigo-600">
                    {deficit} kcal
                  </span>
                </div>
                <input 
                  id="deficit-slider"
                  type="range" 
                  min="100" 
                  max="1500" 
                  step="50" 
                  value={deficit}
                  onChange={(e) => setDeficit(parseInt(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-2 uppercase font-bold tracking-tighter">
                  <span>Maintenance (100)</span>
                  <span>Aggressive (1500)</span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <label htmlFor="target-fat-loss-input" className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">
                  Target Fat Loss Goal (kg)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="target-fat-loss-input"
                    type="number"
                    min="1"
                    max="50"
                    value={targetFatLoss}
                    onChange={(e) => setTargetFatLoss(Math.max(1, parseInt(e.target.value) || 0))}
                    className="w-20 text-sm bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:bg-white focus:border-slate-400 focus:outline-hidden transition-colors font-mono"
                  />
                  <span className="text-xs text-slate-500">
                    kg of pure body fat
                  </span>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">
                  Estimated Timeline
                </h3>
                <div className="flex items-baseline gap-2">
                  <span id="estimated-weeks-display" className="text-6xl font-light text-slate-900">
                    {estimatedWeeks}
                  </span>
                  <span className="text-xl text-slate-400">Weeks</span>
                </div>
                <p className="text-sm text-slate-500 mt-2">
                  To lose {targetFatLoss}kg of body fat at this pace.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="px-8 py-4 bg-slate-50 border-t border-slate-200">
        <p className="text-[10px] text-slate-400 uppercase tracking-widest text-center">
          Note: Data is session-based and will reset on page refresh.
        </p>
      </footer>
    </div>
  );
}
