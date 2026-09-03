import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
      {/* Top System Status Banner */}
      <div className="bg-slate-900 text-slate-100 text-xs py-1.5 px-4 sm:px-8 border-b border-slate-800 flex items-center justify-between font-mono">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
          <span>SYSTEM STATUS: OPERATIONAL</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-400">REGIONAL EMS TELEMETRY NETWORK</span>
        </div>
        <div className="hidden md:flex items-center gap-4 text-slate-400">
          <span>LATENCY: 14ms</span>
          <span>ENCRYPTED END-TO-END</span>
        </div>
      </div>

      {/* Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-8 h-8 bg-slate-900 text-white font-bold flex items-center justify-center text-sm font-mono tracking-wider rounded-sm">
                BR
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-lg text-slate-900 tracking-tight leading-none font-mono">
                  BED<span className="text-blue-700">RELAY</span>
                </span>
                <span className="text-[10px] text-slate-500 font-mono tracking-widest uppercase mt-0.5">
                  EMS Capacity Telemetry
                </span>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
              <Link href="#overview" className="hover:text-slate-900 transition-colors">
                Overview
              </Link>
              <Link href="#how-it-works" className="hover:text-slate-900 transition-colors">
                How It Works
              </Link>
              <Link href="#categories" className="hover:text-slate-900 transition-colors">
                Bed Categories
              </Link>
              <Link href="#workflow" className="hover:text-slate-900 transition-colors">
                3-Step Workflow
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-400 bg-white rounded-sm transition-all"
            >
              Hospital Staff
            </Link>
            <Link
              href="/find-beds"
              className="px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white bg-slate-900 hover:bg-slate-800 rounded-sm transition-all shadow-sm"
            >
              Ambulance / Dispatcher
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="bg-white border-b border-slate-200 py-16 sm:py-24">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-slate-100 border border-slate-300 text-slate-700 font-mono text-xs font-semibold rounded-sm mb-6">
                <span className="w-1.5 h-1.5 bg-blue-700 rounded-full"></span>
                PRE-HOSPITAL DIVERSION REDUCTION PLATFORM
              </div>

              <h1 className="text-3xl sm:text-5xl font-bold tracking-tight text-slate-900 font-sans leading-tight">
                Real-Time Hospital Bed Telemetry for Emergency Medical Services
              </h1>

              <p className="mt-6 text-lg text-slate-600 leading-relaxed font-normal">
                BedRelay bridges the critical gap between hospital bed control managers and inbound ambulance dispatchers. 
                Maintain live capacity data, prevent emergency room overcrowding, and ensure ambulances divert only to facilities with verified, ready beds.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center px-6 py-3.5 bg-blue-700 hover:bg-blue-800 text-white font-semibold text-sm tracking-wide rounded-sm transition-colors shadow-sm"
                >
                  Hospital Staff Sign In
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>
                </Link>

                <Link
                  href="/find-beds"
                  className="inline-flex items-center justify-center px-6 py-3.5 bg-white hover:bg-slate-50 text-slate-900 font-semibold text-sm tracking-wide border border-slate-300 rounded-sm transition-colors"
                >
                  Find Available Beds
                </Link>
              </div>

              <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-8 border-t border-slate-200">
                <div className="bg-slate-50 p-4 border border-slate-200 rounded-sm">
                  <div className="text-xs font-mono text-slate-500 uppercase">Live Synchronization</div>
                  <div className="text-xl font-bold text-slate-900 mt-1 font-mono">&lt; 30 Seconds</div>
                  <div className="text-xs text-slate-600 mt-1">From floor update to dispatcher screen</div>
                </div>
                <div className="bg-slate-50 p-4 border border-slate-200 rounded-sm">
                  <div className="text-xs font-mono text-slate-500 uppercase">Tracked Categories</div>
                  <div className="text-xl font-bold text-slate-900 mt-1 font-mono">ICU / Gen / Vent</div>
                  <div className="text-xs text-slate-600 mt-1">Critical care and general capacity</div>
                </div>
                <div className="bg-slate-50 p-4 border border-slate-200 rounded-sm">
                  <div className="text-xs font-mono text-slate-500 uppercase">Dispatch Coordination</div>
                  <div className="text-xl font-bold text-slate-900 mt-1 font-mono">Direct Pre-Arrival</div>
                  <div className="text-xs text-slate-600 mt-1">Instant notification to receiving unit</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-16 bg-slate-50 border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="border-l-2 border-blue-700 pl-4 mb-10">
              <span className="text-xs font-mono text-blue-700 uppercase tracking-widest block">OPERATIONAL MODEL</span>
              <h2 className="text-2xl font-bold text-slate-900 mt-1">How Bed Updates Reach Ambulance Dispatchers</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 border border-slate-200 rounded-sm">
                <div className="w-8 h-8 bg-slate-100 text-slate-900 font-mono font-bold text-sm flex items-center justify-center border border-slate-300 mb-4 rounded-sm">
                  01
                </div>
                <h3 className="text-base font-semibold text-slate-900">Hospital Floor Telemetry</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Hospital staff update bed status in seconds using a streamlined operational interface as patients are admitted, transferred, or discharged.
                </p>
              </div>

              <div className="bg-white p-6 border border-slate-200 rounded-sm">
                <div className="w-8 h-8 bg-slate-100 text-slate-900 font-mono font-bold text-sm flex items-center justify-center border border-slate-300 mb-4 rounded-sm">
                  02
                </div>
                <h3 className="text-base font-semibold text-slate-900">Regional Network Broadcast</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Capacity metrics are validated and immediately broadcasted to all authenticated EMS units and dispatch centers in the regional cluster.
                </p>
              </div>

              <div className="bg-white p-6 border border-slate-200 rounded-sm">
                <div className="w-8 h-8 bg-slate-100 text-slate-900 font-mono font-bold text-sm flex items-center justify-center border border-slate-300 mb-4 rounded-sm">
                  03
                </div>
                <h3 className="text-base font-semibold text-slate-900">Data-Driven Routing</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Ambulance teams evaluate real-time bed availability before initiating transport, avoiding overcrowded emergency departments.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Bed Categories Section */}
        <section id="categories" className="py-16 bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="border-l-2 border-slate-900 pl-4 mb-10">
              <span className="text-xs font-mono text-slate-500 uppercase tracking-widest block">CAPACITY MONITORING</span>
              <h2 className="text-2xl font-bold text-slate-900 mt-1">Supported Bed Categories</h2>
            </div>

            <div className="overflow-hidden border border-slate-200 rounded-sm">
              <table className="w-full text-left text-sm border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-mono text-xs uppercase border-b border-slate-200">
                  <tr>
                    <th className="py-3.5 px-4 font-semibold">Category Code</th>
                    <th className="py-3.5 px-4 font-semibold">Category Name</th>
                    <th className="py-3.5 px-4 font-semibold">Clinical Scope</th>
                    <th className="py-3.5 px-4 font-semibold">Tracking Metric</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  <tr>
                    <td className="py-4 px-4 font-mono font-semibold text-slate-900">ICU-01</td>
                    <td className="py-4 px-4 font-semibold text-slate-900">Intensive Care Unit (ICU)</td>
                    <td className="py-4 px-4 text-slate-600">Cardiac, Surgical, Trauma & Neurological critical care</td>
                    <td className="py-4 px-4 text-slate-600 font-mono text-xs">Total / Available / Occupied</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-4 font-mono font-semibold text-slate-900">GEN-02</td>
                    <td className="py-4 px-4 font-semibold text-slate-900">General Medical / Surgical</td>
                    <td className="py-4 px-4 text-slate-600">Standard inpatient beds, observation units, step-down wards</td>
                    <td className="py-4 px-4 text-slate-600 font-mono text-xs">Total / Available / Occupied</td>
                  </tr>
                  <tr>
                    <td className="py-4 px-4 font-mono font-semibold text-slate-900">VENT-03</td>
                    <td className="py-4 px-4 font-semibold text-slate-900">Ventilator & Respiratory Care</td>
                    <td className="py-4 px-4 text-slate-600">Advanced mechanical ventilation and high-flow oxygen beds</td>
                    <td className="py-4 px-4 text-slate-600 font-mono text-xs">Total / Available / Occupied</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* 3-Step Workflow Section */}
        <section id="workflow" className="py-16 bg-slate-50 border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="border-l-2 border-blue-700 pl-4 mb-10">
              <span className="text-xs font-mono text-blue-700 uppercase tracking-widest block">OPERATIONAL WORKFLOW</span>
              <h2 className="text-2xl font-bold text-slate-900 mt-1">Simple 3-Step Relay Process</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
              <div className="bg-white p-6 border border-slate-200 rounded-sm relative">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-mono font-bold bg-slate-900 text-white px-2 py-1 rounded-sm">STEP 01</span>
                  <span className="text-xs font-mono text-slate-500">HOSPITAL STAFF</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900">Update Availability</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Hospital charge nurses or bed managers adjust bed counts as patients enter or leave specialized units.
                </p>
              </div>

              <div className="bg-white p-6 border border-slate-200 rounded-sm relative">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-mono font-bold bg-slate-900 text-white px-2 py-1 rounded-sm">STEP 02</span>
                  <span className="text-xs font-mono text-slate-500">DISPATCHER / EMS</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900">Find Suitable Hospital</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Ambulance staff filter nearby hospitals by required bed category (ICU, Ventilator, General) and capacity.
                </p>
              </div>

              <div className="bg-white p-6 border border-slate-200 rounded-sm relative">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-mono font-bold bg-blue-700 text-white px-2 py-1 rounded-sm">STEP 03</span>
                  <span className="text-xs font-mono text-slate-500">EMS & HOSPITAL</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900">Send Dispatch Request</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                  Paramedics transmit a pre-arrival dispatch alert directly to the receiving hospital for smooth intake.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Operational Footer */}
      <footer className="bg-slate-900 text-slate-400 py-12 text-sm border-t border-slate-800 font-mono">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="text-white font-bold text-base tracking-tight mb-1">
              BED<span className="text-blue-500">RELAY</span> INFRASTRUCTURE
            </div>
            <p className="text-xs text-slate-500 max-w-md">
              Emergency Medical Services Pre-Hospital Bed Capacity Telemetry Network. Built for operational efficiency and zero-delay patient transfers.
            </p>
          </div>
          <div className="flex flex-wrap gap-6 text-xs">
            <Link href="/dashboard" className="hover:text-white transition-colors">
              Hospital Dashboard
            </Link>
            <Link href="/find-beds" className="hover:text-white transition-colors">
              Dispatcher Console
            </Link>
            <span className="text-slate-600">|</span>
            <span className="text-slate-500">© 2026 BedRelay Infrastructure Network</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

