import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, Square } from 'lucide-react';

type Message = {
  id: string;
  role: 'user' | 'system';
  content: string;
  timestamp: Date;
};

type Screen = 'conversation' | 'form-preview';

export default function App() {
  const [screen, setScreen] = useState('conversation' as Screen);
  const [isRecording, setIsRecording] = useState(false);
  const [messages] = useState([
    {
      id: '1',
      role: 'system',
      content: 'Describe your situation in your own words.',
      timestamp: new Date(),
    },
    {
      id: '2',
      role: 'user',
      content: 'I lost my job two weeks ago and I'm struggling to pay for groceries and heating. I have two kids and I don't know where to start.',
      timestamp: new Date(),
    },
    {
      id: '3',
      role: 'system',
      content: 'Based on your situation, you may qualify for emergency food assistance (SNAP) and heating support (LIHEAP). I will complete both applications for you.',
      timestamp: new Date(),
    },
    {
      id: '4',
      role: 'system',
      content: 'What county do you live in?',
      timestamp: new Date(),
    },
    {
      id: '5',
      role: 'user',
      content: 'Alameda County',
      timestamp: new Date(),
    },
    {
      id: '6',
      role: 'system',
      content: 'How many people live in your household, including yourself?',
      timestamp: new Date(),
    },
    {
      id: '7',
      role: 'user',
      content: 'Three. Me and my two kids.',
      timestamp: new Date(),
    },
    {
      id: '8',
      role: 'system',
      content: 'When did you lose your job?',
      timestamp: new Date(),
    },
    {
      id: '9',
      role: 'user',
      content: 'March 29th',
      timestamp: new Date(),
    },
  ]);

  const handleVoiceToggle = () => {
    setIsRecording(!isRecording);
    if (!isRecording) {
      setTimeout(() => setIsRecording(false), 2000);
    }
  };

  const handleViewForm = () => {
    setScreen('form-preview');
  };

  const handleBackToConversation = () => {
    setScreen('conversation');
  };

  return (
    <div className="h-screen flex flex-col bg-white">
      <AnimatePresence mode="wait">
        {screen === 'conversation' ? (
          <motion.div
            key="conversation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col h-full"
          >
            {/* Header */}
            <header className="border-b border-neutral-900 px-4 py-3">
              <div className="flex items-baseline justify-between">
                <div className="text-[11px] uppercase tracking-[0.15em] font-medium">
                  Freeform
                </div>
                <div className="text-[10px] text-neutral-500 uppercase tracking-wider">
                  Session Active
                </div>
              </div>
            </header>

            {/* Transcript */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-4 py-6">
                {messages.map((message, index) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, delay: index * 0.03 }}
                    className="mb-6 last:mb-0"
                  >
                    <div className="flex gap-3">
                      <div className="w-10 pt-0.5 shrink-0">
                        <div className="text-[9px] uppercase tracking-[0.12em] text-neutral-400">
                          {message.role === 'system' ? 'SYS' : 'YOU'}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[15px] leading-[1.6] text-neutral-900">
                          {message.content}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}

                {/* Next Action */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2, delay: messages.length * 0.03 }}
                  className="mt-10 pt-6 border-t border-neutral-200"
                >
                  <button
                    onClick={handleViewForm}
                    className="w-full bg-neutral-900 text-white py-3.5 text-[11px] uppercase tracking-[0.15em] font-medium hover:bg-neutral-800 transition-colors"
                  >
                    Review Application
                  </button>
                </motion.div>
              </div>
            </div>

            {/* Voice Input - Fixed */}
            <div className="border-t border-neutral-900 bg-white">
              <div className="px-4 py-4">
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleVoiceToggle}
                    className={`shrink-0 w-11 h-11 flex items-center justify-center transition-colors ${
                      isRecording
                        ? 'bg-red-600 text-white'
                        : 'bg-neutral-900 text-white hover:bg-neutral-800'
                    }`}
                  >
                    {isRecording ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  </button>
                  <div className="flex-1">
                    {isRecording ? (
                      <div className="text-[11px] uppercase tracking-[0.12em] text-neutral-500">
                        Recording
                      </div>
                    ) : (
                      <div className="text-[11px] uppercase tracking-[0.12em] text-neutral-400">
                        Press to speak
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="form-preview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col h-full bg-white"
          >
            {/* Header */}
            <header className="border-b border-neutral-900 px-4 py-3">
              <div className="flex items-center justify-between">
                <button
                  onClick={handleBackToConversation}
                  className="text-[10px] uppercase tracking-[0.15em] text-neutral-500 hover:text-neutral-900 transition-colors"
                >
                  ← Return
                </button>
                <div className="text-[9px] uppercase tracking-[0.15em] text-neutral-400">
                  Draft
                </div>
              </div>
            </header>

            {/* Document */}
            <div className="flex-1 overflow-y-auto bg-neutral-50">
              <div className="p-4">
                {/* Document Header */}
                <div className="bg-white border border-neutral-900 mb-4">
                  <div className="border-b border-neutral-900 px-4 py-3">
                    <div className="text-[9px] uppercase tracking-[0.15em] text-neutral-500 mb-2">
                      Form CA-SNAP-1
                    </div>
                    <h1 className="text-[17px] tracking-tight font-medium leading-tight">
                      Supplemental Nutrition Assistance Program
                    </h1>
                    <div className="text-[11px] text-neutral-600 mt-1">
                      California Application for Benefits
                    </div>
                  </div>

                  {/* Form Body */}
                  <div className="px-4 py-4">
                    <DocumentSection title="I. Applicant Information">
                      <DataField label="Legal Name (Last, First, Middle)" value="[REDACTED FOR PRIVACY]" />
                      <DataField label="Date of Birth" value="[REDACTED]" />
                      <DataField label="Social Security Number" value="XXX-XX-[REDACTED]" />
                      <DataField label="Contact Phone" value="[REDACTED]" />
                    </DocumentSection>

                    <DocumentSection title="II. Household Composition">
                      <DataField label="Total Household Members" value="3" />
                      <DataField label="Children Under 18" value="2" />
                      <DataField label="Elderly or Disabled Members" value="0" />
                    </DocumentSection>

                    <DocumentSection title="III. Residence">
                      <DataField label="Street Address" value="[REDACTED FOR PRIVACY]" />
                      <DataField label="City" value="[REDACTED]" />
                      <DataField label="County" value="Alameda" />
                      <DataField label="State" value="California" />
                      <DataField label="ZIP Code" value="[REDACTED]" />
                      <DataField label="Housing Status" value="Renting" />
                    </DocumentSection>

                    <DocumentSection title="IV. Income & Employment">
                      <DataField label="Current Employment Status" value="Unemployed" />
                      <DataField label="Date of Separation" value="March 29, 2026" />
                      <DataField label="Current Monthly Gross Income" value="$0.00" />
                      <DataField label="Unemployment Benefits" value="Pending" />
                      <DataField label="Other Income Sources" value="None" />
                    </DocumentSection>

                    <DocumentSection title="V. Expenses">
                      <DataField label="Monthly Rent/Mortgage" value="[REDACTED]" />
                      <DataField label="Utilities (Heat, Electric)" value="[REDACTED]" />
                      <DataField label="Childcare Costs" value="[REDACTED]" />
                    </DocumentSection>

                    <DocumentSection title="VI. Emergency Circumstances">
                      <DataField
                        label="Statement of Need"
                        value="Recent involuntary job loss. Household includes two minor dependents. Currently unable to meet basic food and heating needs. First-time application for government assistance."
                      />
                    </DocumentSection>

                    <DocumentSection title="VII. Certification" last>
                      <div className="text-[11px] leading-[1.6] text-neutral-700">
                        I certify under penalty of perjury that the information provided in this application is
                        true and complete to the best of my knowledge. I understand that providing false
                        information may result in disqualification from benefits and legal penalties.
                      </div>
                      <div className="mt-4 pt-3 border-t border-neutral-300">
                        <DataField label="Electronic Signature" value="[TO BE SIGNED]" />
                        <DataField label="Date" value="April 12, 2026" />
                      </div>
                    </DocumentSection>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2 mb-4">
                  <button className="w-full bg-neutral-900 text-white py-3.5 text-[11px] uppercase tracking-[0.15em] font-medium hover:bg-neutral-800 transition-colors">
                    Download as PDF
                  </button>
                  <button className="w-full border border-neutral-900 text-neutral-900 py-3.5 text-[11px] uppercase tracking-[0.15em] font-medium hover:bg-neutral-100 transition-colors">
                    Locate Submission Center
                  </button>
                  <button className="w-full border border-neutral-300 text-neutral-600 py-3.5 text-[11px] uppercase tracking-[0.15em] font-medium hover:bg-neutral-100 transition-colors">
                    Start New Application
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DocumentSection({
  title,
  children,
  last = false,
}: {
  title: string;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <div className={`${last ? '' : 'mb-6 pb-6 border-b border-neutral-200'}`}>
      <h3 className="text-[10px] uppercase tracking-[0.15em] font-medium text-neutral-900 mb-4">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function DataField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="text-[9px] uppercase tracking-[0.12em] text-neutral-500">{label}</div>
      <div className="text-[13px] leading-[1.5] text-neutral-900 font-mono">{value}</div>
    </div>
  );
}
