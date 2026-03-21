<template>
  <el-scrollbar :style="'height: 100vh; height: 100dvh;'">
    <router-view v-slot="{ Component, route }">
      <transition name="page-fade-slide" mode="out-in">
        <component :is="Component" :key="route.matched[0]?.path || route.path" />
      </transition>
    </router-view>
  </el-scrollbar>
</template>
