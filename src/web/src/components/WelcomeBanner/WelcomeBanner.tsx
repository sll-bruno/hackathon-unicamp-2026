import styles from './WelcomeBanner.module.css';

// Nome fixo para a demo — não há autenticação real neste momento do projeto.
export const DEFAULT_LAWYER_NAME = 'Clara Porter';

export function WelcomeBanner({ name = DEFAULT_LAWYER_NAME }: { name?: string }) {
  return (
    <p className={styles.welcome}>
      Bem-vindo(a), <span className={styles.name}>{name}</span>
    </p>
  );
}
