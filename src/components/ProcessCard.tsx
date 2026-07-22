// src/components/ProcessCard.tsx
import React from 'react';
import styles from './ProcessCard.module.css';
import { Cpu, Activity, Server } from 'lucide-react';

interface ProcessCardProps {
  appName: string;
  active: number;
  pid: number;
  command: string;
  cpu: number; // in %
  ram: number; // in %
}

export const ProcessCard: React.FC<ProcessCardProps> = ({
  appName,
  active,
  pid,
  command,
  cpu,
  ram,
}) => {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <Server size={20} className={styles.icon} />
        <h3 className={styles.title}>{appName}</h3>
      </div>
      <div className={styles.body}>
        <p className={styles.info}>🟢 {active} aktywnych</p>
        <p className={styles.info}>PID: {pid}</p>
        <p className={styles.command}>{command}</p>
        <div className={styles.metrics}>
          <div className={styles.metric}>
            <Cpu size={16} className={styles.metricIcon} />
            <span>{cpu.toFixed(1)} %</span>
          </div>
          <div className={styles.metric}>
            <Activity size={16} className={styles.metricIcon} />
            <span>{ram.toFixed(1)} %</span>
          </div>
        </div>
      </div>
    </div>
  );
};
