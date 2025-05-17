import Head from 'next/head';
import Link from 'next/link';
import styles from '../styles/Home.module.css';

export default function Home() {
  return (
    <div className={styles.container}>
      <Head>
        <title>AR Renderer</title>
        <meta name="description" content="AR Renderer with Next.js and Three.js" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main className={styles.main}>
        <h1 className={styles.title}>
          Welcome to <span className={styles.highlight}>AR Renderer</span>
        </h1>

        <p className={styles.description}>
          Experience 3D models in augmented reality
        </p>

        <div className={styles.grid}>
          <Link href="/ar" className={styles.card}>
            <h2>Launch AR Experience &rarr;</h2>
            <p>View 3D models in your real-world environment using AR.</p>
          </Link>
        </div>
      </main>

      <footer className={styles.footer}>
        <p>
          Powered by Next.js and Three.js
        </p>
      </footer>
    </div>
  );
}
