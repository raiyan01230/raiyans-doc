const fs = require('fs');
let code = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');
const buttonStr = `
          <button
            onClick={() => setActiveTab('incidents')}
            className={\`flex items-center gap-1.5 px-3 py-1 text-xs font-mono rounded-lg transition-colors whitespace-nowrap \${
              activeTab === 'incidents'
                ? 'bg-neutral-800 text-neutral-100 font-semibold border border-neutral-700'
                : 'text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800/50'
            }\`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
            <span>Incidents</span>
          </button>
`;

code = code.replace("onClick={() => setActiveTab('security')}", buttonStr.trim() + "\n          <button\n            onClick={() => setActiveTab('security')}");

const contentStr = `
          {activeTab === 'security' && <SecurityRecoveryView onNavigate={setActiveTab} />}
          {activeTab === 'incidents' && <IncidentsView />}
`;

code = code.replace("{activeTab === 'security' && <SecurityRecoveryView onNavigate={setActiveTab} />}", contentStr.trim());

fs.writeFileSync('src/components/Dashboard.tsx', code);
