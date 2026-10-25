# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# Calibration-only first R8 adoption step: measure code shrinking while keeping
# class/method names and disabling optimizer rewrites. Do not ship this branch;
# the goal is to validate release packaging and size before device smoke testing.
-dontobfuscate
-dontoptimize
