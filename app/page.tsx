import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#000000] text-slate-900 dark:text-[#ededed] font-sans antialiased transition-colors duration-150">
      {/* Navigation Bar */}
      <header className="bg-white dark:bg-[#0a0a0a] border-b border-slate-200 dark:border-[#222222] sticky top-0 z-50">
        <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 min-h-16 py-2.5 sm:py-0 flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 bg-slate-900 dark:bg-[#ededed] text-white dark:text-black font-bold flex items-center justify-center text-sm font-mono tracking-wider rounded-sm shrink-0">
                BR
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-base sm:text-lg text-slate-900 dark:text-[#ededed] tracking-tight leading-none font-mono">
                  BED<span className="text-blue-700 dark:text-blue-400">RELAY</span>
                </span>
                <span className="text-[9px] sm:text-[10px] text-slate-500 dark:text-[#737373] font-mono tracking-widest uppercase mt-0.5 truncate max-w-[140px] sm:max-w-none">
                  EMS Capacity Telemetry
                </span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-[#888888]">
              <Link href="#overview" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                Overview
              </Link>
              <Link href="#how-it-works" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                How It Works
              </Link>
              <Link href="#categories" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                Bed Categories
              </Link>
              <Link href="#workflow" className="hover:text-slate-900 dark:hover:text-white transition-colors">
                3-Step Workflow
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <ThemeToggle />
            <Link
              href="/find-beds"
              className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-white bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 rounded-sm transition-all shadow-xs cursor-pointer"
            >
              Find Beds
            </Link>
            <Link
              href="/dashboard"
              className="px-2.5 sm:px-4 py-1.5 sm:py-2 text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-[#ededed] hover:text-slate-900 dark:hover:text-white border border-slate-300 dark:border-[#2a2a2a] hover:border-slate-400 dark:hover:border-[#444] bg-white dark:bg-[#0f0f0f] rounded-sm transition-all cursor-pointer"
            >
              Hospital Staff
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section id="overview" className="bg-white dark:bg-[#0a0a0a] border-b border-slate-200 dark:border-[#222222] py-16 sm:py-24">
          <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12">
            <div className="max-w-4xl lg:max-w-5xl mx-auto text-center flex flex-col items-center">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-[#181818] border border-slate-300 dark:border-[#2a2a2a] text-slate-700 dark:text-[#a1a1a1] font-mono text-xs font-semibold rounded-sm mb-6 max-w-full">
                <span className="w-1.5 h-1.5 bg-blue-700 dark:bg-blue-500 rounded-full shrink-0"></span>
                <span>AMBULANCE-TO-HOSPITAL PRE-ARRIVAL COORDINATION PLATFORM</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 dark:text-[#ededed] font-sans leading-tight">
                Real-Time Bed Availability & <br />Pre-Arrival Coordination
              </h1>

              <p className="mt-6 text-base sm:text-lg text-slate-600 dark:text-[#a1a1a1] leading-relaxed font-normal max-w-2xl">
                BedRelay is a real-time ambulance-to-hospital bed availability and pre-arrival coordination platform. Hospitals maintain current bed capacity across intensive care, ventilator support, neonatal, pediatric (PICU), and general wards. Ambulance dispatchers locate suitable facilities based on geographic proximity, bed category, and required volume, transmitting verified pre-arrival dispatch alerts.
              </p>

              {/* Action Hierarchy: Primary = FIND AVAILABLE BEDS, Secondary = HOSPITAL STAFF SIGN IN */}
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full sm:w-auto">
                <Link
                  href="/find-beds"
                  className="w-full sm:w-auto inline-flex items-center justify-center px-7 py-3.5 bg-blue-700 hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold text-sm tracking-wide rounded-sm transition-colors shadow-sm cursor-pointer"
                >
                  FIND AVAILABLE BEDS
                  <svg className="w-4 h-4 ml-2 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </Link>

                <Link
                  href="/dashboard"
                  className="w-full sm:w-auto inline-flex items-center justify-center px-6 py-3.5 bg-white dark:bg-[#111111] hover:bg-slate-50 dark:hover:bg-[#181818] text-slate-800 dark:text-[#ededed] font-semibold text-sm tracking-wide border border-slate-300 dark:border-[#2a2a2a] rounded-sm transition-colors cursor-pointer"
                >
                  HOSPITAL STAFF SIGN IN
                </Link>
              </div>

              <div className="mt-12 grid grid-cols-1 sm:grid-cols-[1fr_1.35fr_1fr] lg:grid-cols-[1fr_1.45fr_1fr] gap-4 pt-8 border-t border-slate-200 dark:border-[#222222] w-full text-left">
                <div className="bg-slate-50 dark:bg-[#111111] p-4 border border-slate-200 dark:border-[#222222] rounded-sm">
                  <div className="text-xs font-mono text-slate-500 dark:text-[#737373] uppercase">Data Synchronization</div>
                  <div className="text-xl font-bold text-slate-900 dark:text-[#ededed] mt-1 font-mono">&lt; 02 seconds</div>
                  <div className="text-xs text-slate-600 dark:text-[#888888] mt-1">Continuous live server synchronization</div>
                </div>
                <div className="bg-slate-50 dark:bg-[#111111] p-4 border border-slate-200 dark:border-[#222222] rounded-sm">
                  <div className="text-xs font-mono text-slate-500 dark:text-[#737373] uppercase">Tracked Categories</div>
                  <div className="text-xl font-bold text-slate-900 dark:text-[#ededed] mt-1 font-mono leading-snug">
                    <span>ICU / General / Ventilator /</span>{" "}
                    <span className="whitespace-nowrap">NICU / PICU</span>
                  </div>
                  <div className="text-xs text-slate-600 dark:text-[#888888] mt-1">Intensive, general, ventilator, neonatal, and pediatric critical capacity</div>
                </div>
                <div className="bg-slate-50 dark:bg-[#111111] p-4 border border-slate-200 dark:border-[#222222] rounded-sm">
                  <div className="text-xs font-mono text-slate-500 dark:text-[#737373] uppercase">Dispatch Coordination</div>
                  <div className="text-xl font-bold text-slate-900 dark:text-[#ededed] mt-1 font-mono">Pre-Arrival Alerts</div>
                  <div className="text-xs text-slate-600 dark:text-[#888888] mt-1">Instant notification to receiving unit</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-16 bg-slate-50 dark:bg-[#000000] border-b border-slate-200 dark:border-[#222222]">
          <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12">
            <div className="border-l-2 border-blue-700 dark:border-blue-500 pl-4 mb-10">
              <span className="text-xs font-mono text-blue-700 dark:text-blue-400 uppercase tracking-widest block">OPERATIONAL MODEL</span>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-[#ededed] mt-1">How Bed Updates Reach Ambulance Dispatchers</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-[#0f0f0f] p-6 border border-slate-200 dark:border-[#222222] rounded-sm">
                <div className="w-8 h-8 bg-slate-100 dark:bg-[#181818] text-slate-900 dark:text-[#ededed] font-mono font-bold text-sm flex items-center justify-center border border-slate-300 dark:border-[#2a2a2a] mb-4 rounded-sm">
                  01
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-[#ededed]">Hospital Floor Telemetry</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-[#888888] leading-relaxed">
                  Hospital staff update bed status in seconds using a streamlined operational interface as patients are admitted, transferred, or discharged.
                </p>
              </div>

              <div className="bg-white dark:bg-[#0f0f0f] p-6 border border-slate-200 dark:border-[#222222] rounded-sm">
                <div className="w-8 h-8 bg-slate-100 dark:bg-[#181818] text-slate-900 dark:text-[#ededed] font-mono font-bold text-sm flex items-center justify-center border border-slate-300 dark:border-[#2a2a2a] mb-4 rounded-sm">
                  02
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-[#ededed]">Regional Network Broadcast</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-[#888888] leading-relaxed">
                  Capacity metrics are validated and immediately broadcasted to all authenticated EMS units and dispatch centers in the regional cluster.
                </p>
              </div>

              <div className="bg-white dark:bg-[#0f0f0f] p-6 border border-slate-200 dark:border-[#222222] rounded-sm">
                <div className="w-8 h-8 bg-slate-100 dark:bg-[#181818] text-slate-900 dark:text-[#ededed] font-mono font-bold text-sm flex items-center justify-center border border-slate-300 dark:border-[#2a2a2a] mb-4 rounded-sm">
                  03
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-[#ededed]">Data-Driven Routing</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-[#888888] leading-relaxed">
                  Ambulance teams evaluate real-time bed availability before initiating transport, avoiding overcrowded emergency departments.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Bed Categories Section */}
        <section id="categories" className="py-16 bg-white dark:bg-[#0a0a0a] border-b border-slate-200 dark:border-[#222222]">
          <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12">
            <div className="border-l-2 border-slate-900 dark:border-[#ededed] pl-4 mb-10">
              <span className="text-xs font-mono text-slate-500 dark:text-[#737373] uppercase tracking-widest block">CAPACITY MONITORING</span>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-[#ededed] mt-1">Supported Bed Categories</h2>
            </div>

            {/* Mobile Cards Layout (visible < md) */}
            <div className="block md:hidden space-y-3">
              {[
                {
                  code: "ICU-01",
                  name: "Intensive Care Unit (ICU)",
                  scope: "Cardiac, Surgical, Trauma & Neurological critical care",
                  metric: "Total / Available / Occupied",
                },
                {
                  code: "GEN-02",
                  name: "General Medical / Surgical",
                  scope: "Standard inpatient beds, observation units, step-down wards",
                  metric: "Total / Available / Occupied",
                },
                {
                  code: "VENT-03",
                  name: "Ventilator & Respiratory Care",
                  scope: "Advanced mechanical ventilation and high-flow oxygen beds",
                  metric: "Total / Available / Occupied",
                },
                {
                  code: "NICU-04",
                  name: "Neonatal Intensive Care (NICU)",
                  scope: "Neonatal critical care, premature infant stabilization",
                  metric: "Total / Available / Occupied",
                },
                {
                  code: "PICU-05",
                  name: "Pediatric Intensive Care (PICU)",
                  scope: "Critically ill infants, children, and adolescents specialized care",
                  metric: "Total / Available / Occupied",
                },
              ].map((cat) => (
                <div
                  key={cat.code}
                  className="bg-white dark:bg-[#0f0f0f] border border-slate-200 dark:border-[#222222] p-4 rounded-sm space-y-3 shadow-xs"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono font-bold text-xs bg-slate-100 dark:bg-[#1f1f1f] text-slate-900 dark:text-[#ededed] px-2.5 py-1 rounded-sm border border-slate-200 dark:border-[#333]">
                      {cat.code}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-slate-900 dark:text-[#ededed]">{cat.name}</h3>
                    <p className="text-xs text-slate-600 dark:text-[#888] mt-1 leading-relaxed">{cat.scope}</p>
                  </div>
                  <div className="pt-2 border-t border-slate-100 dark:border-[#1a1a1a] flex items-center justify-between text-xs">
                    <span className="text-slate-500 dark:text-[#777] font-mono text-[11px]">Metric:</span>
                    <span className="font-mono text-[11px] text-slate-700 dark:text-[#aaa] bg-slate-50 dark:bg-[#141414] px-2 py-0.5 rounded">
                      {cat.metric}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table (visible md+) */}
            <div className="hidden md:block overflow-x-auto border border-slate-200 dark:border-[#222222] rounded-sm">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-100 dark:bg-[#141414] text-slate-700 dark:text-[#888888] font-mono text-xs uppercase border-b border-slate-200 dark:border-[#222222]">
                  <tr>
                    <th className="py-3.5 px-4 font-semibold">Category Code</th>
                    <th className="py-3.5 px-4 font-semibold">Category Name</th>
                    <th className="py-3.5 px-4 font-semibold">Clinical Scope</th>
                    <th className="py-3.5 px-4 font-semibold">Tracking Metric</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#1f1f1f] bg-white dark:bg-[#0f0f0f]">
                  <tr>
                    <td className="py-4 px-4 font-mono font-semibold text-slate-900 dark:text-[#ededed]">ICU-01</td>
                    <td className="py-4 px-4 font-semibold text-slate-900 dark:text-[#ededed]">Intensive Care Unit (ICU)</td>
                    <td className="py-4 px-4 text-slate-600 dark:text-[#888888]">Cardiac, Surgical, Trauma & Neurological critical care</td>
                    <td className="py-4 px-4 text-slate-600 dark:text-[#888888] font-mono text-xs">Total / Available / Occupied</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-4 font-mono font-semibold text-slate-900 dark:text-[#ededed]">GEN-02</td>
                    <td className="py-4 px-4 font-semibold text-slate-900 dark:text-[#ededed]">General Medical / Surgical</td>
                    <td className="py-4 px-4 text-slate-600 dark:text-[#888888]">Standard inpatient beds, observation units, step-down wards</td>
                    <td className="py-4 px-4 text-slate-600 dark:text-[#888888] font-mono text-xs">Total / Available / Occupied</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-4 font-mono font-semibold text-slate-900 dark:text-[#ededed]">VENT-03</td>
                    <td className="py-4 px-4 font-semibold text-slate-900 dark:text-[#ededed]">Ventilator & Respiratory Care</td>
                    <td className="py-4 px-4 text-slate-600 dark:text-[#888888]">Advanced mechanical ventilation and high-flow oxygen beds</td>
                    <td className="py-4 px-4 text-slate-600 dark:text-[#888888] font-mono text-xs">Total / Available / Occupied</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-4 font-mono font-semibold text-slate-900 dark:text-[#ededed]">NICU-04</td>
                    <td className="py-4 px-4 font-semibold text-slate-900 dark:text-[#ededed]">Neonatal Intensive Care (NICU)</td>
                    <td className="py-4 px-4 text-slate-600 dark:text-[#888888]">Neonatal critical care, premature infant stabilization</td>
                    <td className="py-4 px-4 text-slate-600 dark:text-[#888888] font-mono text-xs">Total / Available / Occupied</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-4 font-mono font-semibold text-slate-900 dark:text-[#ededed]">PICU-05</td>
                    <td className="py-4 px-4 font-semibold text-slate-900 dark:text-[#ededed]">Pediatric Intensive Care (PICU)</td>
                    <td className="py-4 px-4 text-slate-600 dark:text-[#888888]">Critically ill infants, children, and adolescents specialized care</td>
                    <td className="py-4 px-4 text-slate-600 dark:text-[#888888] font-mono text-xs">Total / Available / Occupied</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 3-Step Workflow Section */}
        <section id="workflow" className="py-16 bg-slate-50 dark:bg-[#000000] border-b border-slate-200 dark:border-[#222222]">
          <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12">
            <div className="border-l-2 border-blue-700 dark:border-blue-500 pl-4 mb-10">
              <span className="text-xs font-mono text-blue-700 dark:text-blue-400 uppercase tracking-widest block">OPERATIONAL WORKFLOW</span>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-[#ededed] mt-1">Simple 3-Step Relay Process</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
              <div className="bg-white dark:bg-[#0f0f0f] p-6 border border-slate-200 dark:border-[#222222] rounded-sm relative">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-mono font-bold bg-slate-900 dark:bg-[#ededed] text-white dark:text-black px-2 py-1 rounded-sm">STEP 01</span>
                  <span className="text-xs font-mono text-slate-500 dark:text-[#737373]">HOSPITAL STAFF</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-[#ededed]">Update Availability</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-[#888888] leading-relaxed">
                  Hospital charge nurses or bed managers adjust bed counts as patients enter or leave specialized units.
                </p>
              </div>

              <div className="bg-white dark:bg-[#0f0f0f] p-6 border border-slate-200 dark:border-[#222222] rounded-sm relative">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-mono font-bold bg-slate-900 dark:bg-[#ededed] text-white dark:text-black px-2 py-1 rounded-sm">STEP 02</span>
                  <span className="text-xs font-mono text-slate-500 dark:text-[#737373]">DISPATCHER / EMS</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-[#ededed]">Find Suitable Hospital</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-[#888888] leading-relaxed">
                  Ambulance staff filter nearby hospitals by required bed category (ICU, Ventilator, General, NICU, PICU) and capacity.
                </p>
              </div>

              <div className="bg-white dark:bg-[#0f0f0f] p-6 border border-slate-200 dark:border-[#222222] rounded-sm relative">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-mono font-bold bg-blue-700 dark:bg-blue-600 text-white px-2 py-1 rounded-sm">STEP 03</span>
                  <span className="text-xs font-mono text-slate-500 dark:text-[#737373]">EMS & HOSPITAL</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-[#ededed]">Send Dispatch Request</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-[#888888] leading-relaxed">
                  Paramedics transmit a pre-arrival dispatch alert directly to the receiving hospital for smooth intake.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Operational Footer */}
      <footer className="bg-slate-900 dark:bg-[#080808] text-slate-400 dark:text-[#888888] py-12 text-sm border-t border-slate-800 dark:border-[#1f1f1f] font-mono">
        <div className="w-full max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="text-white dark:text-[#ededed] font-bold text-base tracking-tight mb-1">
              BED<span className="text-blue-500 dark:text-blue-400">RELAY</span> INFRASTRUCTURE
            </div>
            <p className="text-xs text-slate-500 dark:text-[#737373] max-w-md">
              Emergency Medical Services Pre-Hospital Bed Capacity Telemetry Network. Built for operational efficiency and zero-delay patient transfers.
            </p>
          </div>
          <div className="flex flex-wrap gap-6 text-xs">
            <Link href="/dashboard" className="hover:text-white dark:hover:text-[#ededed] transition-colors">
              Hospital Dashboard
            </Link>
            <Link href="/find-beds" className="hover:text-white dark:hover:text-[#ededed] transition-colors">
              Dispatcher Console
            </Link>
            <span className="text-slate-600 dark:text-[#555]">|</span>
            <span className="text-slate-500 dark:text-[#737373]">© 2026 BedRelay Infrastructure Network</span>
          </div>
        </div>
      </footer>
    </div>
  );
}


