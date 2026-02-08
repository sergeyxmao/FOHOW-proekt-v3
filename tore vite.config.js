[1mdiff --git a/src/App.vue b/src/App.vue[m
[1mindex 7998d7e..359cd34 100644[m
[1m--- a/src/App.vue[m
[1m+++ b/src/App.vue[m
[36m@@ -1752,11 +1752,12 @@[m [mbody:has(.app--mobile) {[m
 }[m
 [m
 .zoom-floating-button:hover {[m
[31m-  transform: translateX(-50%);[m
[31m-  box-shadow: 0 24px 42px rgba(15, 98, 254, 0.32);[m
[31m-  background: #0f62fe;[m
[31m-  color: #ffffff;[m
[31m-  border-color: rgba(15, 98, 254, 0.8);[m
[32m+[m[32m  left: 50% !important;[m
[32m+[m[32m  transform: translate(-50%, 0) !important;[m
[32m+[m[32m  box-shadow: 0 24px 42px rgba(255, 193, 7, 0.4);[m
[32m+[m[32m  background: #ffc107;[m
[32m+[m[32m  color: #000000;[m
[32m+[m[32m  border-color: rgba(255, 193, 7, 0.8);[m
 }[m
 [m
 .zoom-floating-button__value {[m
[36m@@ -1772,11 +1773,12 @@[m [mbody:has(.app--mobile) {[m
 }[m
 [m
 .zoom-floating-button--modern:hover {[m
[31m-  transform: translateX(-50%);[m
[31m-  box-shadow: 0 28px 48px rgba(12, 84, 196, 0.4);[m
[31m-  background: #0f62fe;[m
[31m-  color: #ffffff;[m
[31m-  border-color: rgba(15, 98, 254, 0.85);[m
[32m+[m[32m  left: 50% !important;[m
[32m+[m[32m  transform: translate(-50%, 0) !important;[m
[32m+[m[32m  box-shadow: 0 28px 48px rgba(255, 193, 7, 0.5);[m
[32m+[m[32m  background: #ffc107;[m
[32m+[m[32m  color: #000000;[m
[32m+[m[32m  border-color: rgba(255, 193, 7, 0.85);[m
 }[m
 [m
 .save-floating-button {[m
