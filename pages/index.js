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
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>

      <header className={styles.header}>
        <div className={styles.logo}>AR Renderer</div>
        <nav className={styles.nav}>
          <Link href="/" className={styles.navLink}>Home</Link>
          <Link href="/ar" className={styles.navLink}>AR Experience</Link>
          <a href="https://github.com" target="_blank" rel="noopener noreferrer" className={styles.navLink}>GitHub</a>
        </nav>
      </header>

      <main className={styles.main}>
        <div className={styles.hero}>
          <h1 className={styles.title}>
            Experience 3D Models in <span className={styles.highlight}>Augmented Reality</span>
          </h1>

          <p className={styles.description}>
            Place virtual objects in your real-world environment with our WebXR-powered AR viewer.
            No app installation required - works directly in your browser!
          </p>

          <div className={styles.cta}>
            <Link href="/ar" className={styles.ctaButton}>
              Launch AR Experience
            </Link>
          </div>
        </div>

        <div className={styles.features}>
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>📱</div>
            <h3>Mobile Friendly</h3>
            <p>Works on Android devices with Chrome browser. No app installation needed.</p>
          </div>
          
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>🔍</div>
            <h3>Surface Detection</h3>
            <p>Advanced surface detection allows you to place models on real-world surfaces.</p>
          </div>
          
          <div className={styles.featureCard}>
            <div className={styles.featureIcon}>🎮</div>
            <h3>Interactive</h3>
            <p>Tap to place your 3D models anywhere in your environment.</p>
          </div>
        </div>
      </main>

      <footer className={styles.footer}>
        <p>
          Built with Next.js, Three.js and WebXR
        </p>
        <p className={styles.copyright}>
          © 2023 AR Renderer. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
