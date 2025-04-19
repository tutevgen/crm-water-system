from django.contrib import admin
from django.urls import path
from django.http import HttpResponse

def home(request):
    return HttpResponse("CRM работает! 🚀")

urlpatterns = [
    path('', home),  # Главная страница
    path('admin/', admin.site.urls),
]