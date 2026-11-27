plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "id.khenambay.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "id.khenambay.app"
        minSdk = 24
        targetSdk = 35
        versionCode = 4
        versionName = "2.1"
    }

    // Kunci tanda tangan tetap (ikut di repo) supaya APK baru dari GitHub bisa dipasang menimpa versi lama
    // tanpa harus menghapus aplikasi dulu. Hanya untuk prototipe lomba; untuk Play Store pakai kunci rilis rahasia.
    signingConfigs {
        getByName("debug") {
            storeFile = file("khenambay-debug.keystore")
            storePassword = "android"
            keyAlias = "androiddebugkey"
            keyPassword = "android"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        buildConfig = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.core:core-splashscreen:1.0.1")
}
