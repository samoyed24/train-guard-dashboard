<template>
  <el-scrollbar height="100vh">
    <router-view v-slot="{ Component, route }">
      <transition name="page-fade-slide" mode="out-in">
        <component :is="Component" :key="route.matched[0]?.path || route.path" />
      </transition>
    </router-view>
  </el-scrollbar>
</template>
