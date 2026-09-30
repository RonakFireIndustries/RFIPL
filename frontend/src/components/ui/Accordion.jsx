import { useState } from 'react';
import styles from './Accordion.module.css';

export default function Accordion({ sections }) {
  const [openIndex, setOpenIndex] = useState(0);

  const toggle = (index) => {
    setOpenIndex(openIndex === index ? -1 : index);
  };

  return (
    <div className={styles.accordion}>
      {sections.map((section, i) => (
        <div key={i} className={styles.item}>
          <button className={`${styles.header} ${openIndex === i ? styles.open : ''}`} onClick={() => toggle(i)}>
            <span>{section.title}</span>
            <span className={`${styles.arrow} ${openIndex === i ? styles.arrowOpen : ''}`}>&#9662;</span>
          </button>
          {openIndex === i && (
            <div className={styles.content}>{section.content}</div>
          )}
        </div>
      ))}
    </div>
  );
}